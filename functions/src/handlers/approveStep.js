/**
 * approveStep handler.
 *
 * Called by Hasura Action as a POST webhook.
 * Request body shape:
 *   {
 *     action: { name: "approveStep" },
 *     input: { step_run_id: "<uuid>" },
 *     session_variables: {
 *       "x-hasura-user-id": "<uuid>",
 *       "x-hasura-org-id":  "<uuid>",
 *       "x-hasura-role":    "owner" | "editor"
 *     }
 *   }
 *
 * This MUST re-verify the caller's org membership in code, not rely on
 * session role alone — it's a mid-execution decision (PLAN.md layer 2).
 */

const { adminQuery } = require('../hasura');
const { runner } = require('../runner');

async function approveStep(req, res) {
  try {
    const { input, session_variables: sv } = req.body;
    const stepRunId = input?.step_run_id;
    const userId = sv?.['x-hasura-user-id'];
    const orgId = sv?.['x-hasura-org-id'];

    // ── 1. Input validation ────────────────────────────────────────────────
    if (!stepRunId) return res.status(400).json({ message: 'step_run_id is required' });
    if (!userId || !orgId) return res.status(400).json({ message: 'Missing session variables' });

    // ── 2. Load step_run with full context ────────────────────────────────
    const srData = await adminQuery(
      `query GetStepRun($id: uuid!) {
        step_runs_by_pk(id: $id) {
          id
          status
          step {
            id
            step_order
            workflow_id
          }
          run {
            id
            status
            workflow_id
            workflow { org_id }
          }
        }
      }`,
      { id: stepRunId },
    );
    const stepRun = srData.step_runs_by_pk;
    if (!stepRun) return res.status(404).json({ message: 'step_run not found' });

    // ── 3. Verify step_run is actually paused ─────────────────────────────
    if (stepRun.status !== 'paused') {
      return res.status(400).json({
        message: `Cannot approve: step_run status is '${stepRun.status}', expected 'paused'`,
      });
    }

    // ── 4. Verify org matches ─────────────────────────────────────────────
    const stepOrgId = stepRun.run.workflow.org_id;
    if (stepOrgId !== orgId) {
      return res.status(403).json({ message: 'This step_run does not belong to your organization' });
    }

    // ── 5. In-code membership check (owner or editor) ─────────────────────
    //    This is the critical layer-2 check — NOT assumed from session role.
    const memberData = await adminQuery(
      `query CheckMember($user_id: uuid!, $org_id: uuid!) {
        org_members(where: {
          user_id: { _eq: $user_id },
          org_id:  { _eq: $org_id },
          role:    { _in: ["owner", "editor"] }
        }) { role }
      }`,
      { user_id: userId, org_id: orgId },
    );
    if (!memberData.org_members?.length) {
      return res.status(403).json({
        message: 'Not authorized to approve steps in this organization',
      });
    }
    const callerRole = memberData.org_members[0].role;

    // ── 6. Approve: update step_run ───────────────────────────────────────
    const now = new Date().toISOString();
    await adminQuery(
      `mutation ApproveStepRun($id: uuid!, $approved_by: uuid!, $approved_at: timestamptz!) {
        update_step_runs_by_pk(
          pk_columns: { id: $id },
          _set: { status: "done", approved_by: $approved_by, approved_at: $approved_at }
        ) { id }
      }`,
      { id: stepRunId, approved_by: userId, approved_at: now },
    );

    // ── 7. Set workflow_run back to running ───────────────────────────────
    const runId = stepRun.run.id;
    await adminQuery(
      `mutation ResumeRun($id: uuid!) {
        update_workflow_runs_by_pk(pk_columns: { id: $id }, _set: { status: "running" }) { id }
      }`,
      { id: runId },
    );

    // ── 8. Fetch remaining steps (step_order > paused step) ───────────────
    const pausedOrder = stepRun.step.step_order;
    const workflowId = stepRun.run.workflow_id;

    const remainingData = await adminQuery(
      `query GetRemainingSteps($workflow_id: uuid!, $after_order: Int!) {
        workflow_steps(
          where: {
            workflow_id: { _eq: $workflow_id },
            step_order:  { _gt: $after_order }
          }
          order_by: { step_order: asc }
        ) { id step_order type config }
      }`,
      { workflow_id: workflowId, after_order: pausedOrder },
    );
    const remainingSteps = remainingData.workflow_steps;

    // ── 9. Fetch output of the last completed step before the gate ────────
    //    This is the seed for {{previous_output}} in the first post-gate step.
    const lastDoneData = await adminQuery(
      `query LastDoneStepRun($run_id: uuid!, $before_order: Int!) {
        step_runs(
          where: {
            run_id: { _eq: $run_id },
            status: { _eq: "done" },
            step: { step_order: { _lt: $before_order } }
          }
          order_by: { step: { step_order: desc } }
          limit: 1
        ) { output }
      }`,
      { run_id: runId, before_order: pausedOrder },
    );
    const initialPreviousOutput = lastDoneData.step_runs?.[0]?.output ?? null;

    // ── 10. Resume execution ───────────────────────────────────────────────
    let result;
    if (!remainingSteps.length) {
      // No steps remain — mark completed
      await adminQuery(
        `mutation CompleteRun($id: uuid!) {
          update_workflow_runs_by_pk(pk_columns: { id: $id }, _set: { status: "completed" }) { id }
        }`,
        { id: runId },
      );
      // Increment quota on completion
      await adminQuery(
        `mutation IncrementQuota($org_id: uuid!) {
          update_organizations_by_pk(
            pk_columns: { id: $org_id },
            _inc: { calls_used: 1 }
          ) { calls_used }
        }`,
        { org_id: orgId },
      );
      result = { status: 'completed' };
    } else {
      result = await runner(runId, remainingSteps, { callerRole, initialPreviousOutput });
      if (result.status === 'completed') {
        await adminQuery(
          `mutation IncrementQuota($org_id: uuid!) {
            update_organizations_by_pk(
              pk_columns: { id: $org_id },
              _inc: { calls_used: 1 }
            ) { calls_used }
          }`,
          { org_id: orgId },
        );
      }
    }


    return res.json({ run_id: runId, status: result.status, error: result.error ?? null });
  } catch (err) {
    console.error('[approveStep] Unhandled error:', err);
    return res.status(500).json({ message: err.message });
  }
}

module.exports = { approveStep };

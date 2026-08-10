/**
 * triggerWorkflowRun handler.
 *
 * Called by Hasura Action as a POST webhook.
 * Request body shape (Hasura Action format):
 *   {
 *     action: { name: "triggerWorkflowRun" },
 *     input: { workflow_id: "<uuid>" },
 *     session_variables: {
 *       "x-hasura-user-id": "<uuid>",
 *       "x-hasura-org-id":  "<uuid>",
 *       "x-hasura-role":    "owner" | "editor"
 *     }
 *   }
 */

const { adminQuery } = require('../hasura');
const { runner } = require('../runner');

async function triggerWorkflowRun(req, res) {
  try {
    const { input, session_variables: sv } = req.body;
    const workflowId = input?.workflow_id;
    const userId = sv?.['x-hasura-user-id'];
    const orgId = sv?.['x-hasura-org-id'];
    const role = sv?.['x-hasura-role'];

    // ── 1. Basic input validation ──────────────────────────────────────────
    if (!workflowId) return res.status(400).json({ message: 'workflow_id is required' });
    if (!userId || !orgId || !role) {
      return res.status(400).json({ message: 'Missing session variables' });
    }

    // ── 2. Verify workflow belongs to caller's org ─────────────────────────
    const workflowData = await adminQuery(
      `query GetWorkflow($id: uuid!) {
        workflows_by_pk(id: $id) { id org_id }
      }`,
      { id: workflowId },
    );
    const workflow = workflowData.workflows_by_pk;
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    if (workflow.org_id !== orgId) {
      return res.status(403).json({ message: 'Workflow does not belong to your organization' });
    }

    // ── 3. Verify caller is owner or editor in this org (double-check) ─────
    const memberData = await adminQuery(
      `query CheckMember($user_id: uuid!, $org_id: uuid!) {
        org_members(where: {
          user_id: {_eq: $user_id},
          org_id:  {_eq: $org_id},
          role:    {_in: ["owner", "editor"]}
        }) { role }
      }`,
      { user_id: userId, org_id: orgId },
    );
    if (!memberData.org_members?.length) {
      return res.status(403).json({ message: 'Not authorized to trigger runs in this org' });
    }
    const callerRole = memberData.org_members[0].role;

    // ── 4. Quota check ─────────────────────────────────────────────────────
    const orgData = await adminQuery(
      `query CheckQuota($org_id: uuid!) {
        organizations_by_pk(id: $org_id) { calls_used calls_allowed }
      }`,
      { org_id: orgId },
    );
    const org = orgData.organizations_by_pk;
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    if (org.calls_used >= org.calls_allowed) {
      return res.status(429).json({
        message: `Quota exhausted: ${org.calls_used}/${org.calls_allowed} runs used this period`,
      });
    }

    // ── 5. Create workflow_run (status: running) ───────────────────────────
    const runData = await adminQuery(
      `mutation CreateRun($workflow_id: uuid!) {
        insert_workflow_runs_one(object: { workflow_id: $workflow_id, status: "running" }) { id }
      }`,
      { workflow_id: workflowId },
    );
    const runId = runData.insert_workflow_runs_one.id;

    // ── 6. Fetch ordered steps ─────────────────────────────────────────────
    const stepsData = await adminQuery(
      `query GetSteps($workflow_id: uuid!) {
        workflow_steps(
          where: { workflow_id: { _eq: $workflow_id } }
          order_by: { step_order: asc }
        ) { id step_order type config }
      }`,
      { workflow_id: workflowId },
    );
    const steps = stepsData.workflow_steps;
    if (!steps.length) {
      // No steps — mark completed, increment quota
      await adminQuery(
        `mutation CompleteRun($id: uuid!) {
          update_workflow_runs_by_pk(pk_columns: {id: $id}, _set: {status: "completed"}) { id }
        }`,
        { id: runId },
      );
      await incrementQuota(orgId);
      return res.json({ run_id: runId, status: 'completed' });
    }

    // ── 7. Execute steps ───────────────────────────────────────────────────
    const result = await runner(runId, steps, { callerRole });

    // ── 8. On success: increment quota ────────────────────────────────────
    if (result.status === 'completed') {
      await incrementQuota(orgId);
    }

    return res.json({ run_id: runId, status: result.status, error: result.error ?? null });
  } catch (err) {
    console.error('[triggerWorkflowRun] Unhandled error:', err);
    return res.status(500).json({ message: err.message });
  }
}

async function incrementQuota(orgId) {
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

module.exports = { triggerWorkflowRun };

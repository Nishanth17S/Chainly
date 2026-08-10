/**
 * executeRun.js — Shared execution core.
 *
 * Called by both triggerWorkflowRun (Hasura Action, logged-in user) and
 * webhookTrigger (external system authenticated by token).
 *
 * Responsibilities:
 *   - Quota check
 *   - Create workflow_run
 *   - Fetch ordered steps
 *   - Invoke runner
 *   - Increment calls_used on completion
 *
 * Auth and org verification are the CALLER's responsibility — this function
 * assumes both have already been validated.
 *
 * @param {string} workflowId
 * @param {string} orgId
 * @param {string} callerRole  - passed to runner for layer-2 step-type checks
 * @returns {{ run_id: string, status: string, error?: string }}
 */

const { adminQuery } = require('./hasura');
const { runner } = require('./runner');

async function executeRun(workflowId, orgId, callerRole) {
  // ── 1. Quota check ──────────────────────────────────────────────────────
  const orgData = await adminQuery(
    `query CheckQuota($org_id: uuid!) {
      organizations_by_pk(id: $org_id) { calls_used calls_allowed }
    }`,
    { org_id: orgId },
  );
  const org = orgData.organizations_by_pk;
  if (!org) throw Object.assign(new Error('Organization not found'), { statusCode: 404 });
  if (org.calls_used >= org.calls_allowed) {
    throw Object.assign(
      new Error(`Quota exhausted: ${org.calls_used}/${org.calls_allowed} runs used this period`),
      { statusCode: 429 },
    );
  }

  // ── 2. Create workflow_run ───────────────────────────────────────────────
  const runData = await adminQuery(
    `mutation CreateRun($workflow_id: uuid!) {
      insert_workflow_runs_one(object: { workflow_id: $workflow_id, status: "running" }) { id }
    }`,
    { workflow_id: workflowId },
  );
  const runId = runData.insert_workflow_runs_one.id;

  // ── 3. Fetch ordered steps ───────────────────────────────────────────────
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
    // No steps — mark completed and count the run
    await adminQuery(
      `mutation CompleteRun($id: uuid!) {
        update_workflow_runs_by_pk(pk_columns: {id: $id}, _set: {status: "completed"}) { id }
      }`,
      { id: runId },
    );
    await incrementQuota(orgId);
    return { run_id: runId, status: 'completed' };
  }

  // ── 4. Execute steps ─────────────────────────────────────────────────────
  const result = await runner(runId, steps, { callerRole });

  // ── 5. Increment quota on completion ─────────────────────────────────────
  if (result.status === 'completed') {
    await incrementQuota(orgId);
  }

  return { run_id: runId, status: result.status, error: result.error ?? undefined };
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

module.exports = { executeRun };

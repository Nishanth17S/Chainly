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
 *
 * Auth: validates session variables + org membership before delegating
 * to the shared executeRun() core.
 */

const { adminQuery } = require('../hasura');
const { executeRun } = require('../executeRun');

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

    // ── 3. Verify caller is owner or editor in this org (in-code double-check)
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

    // ── 4–8. Quota, create run, execute steps, increment quota ────────────
    const result = await executeRun(workflowId, orgId, callerRole);
    return res.json(result);
  } catch (err) {
    console.error('[triggerWorkflowRun] Unhandled error:', err);
    const status = err.statusCode ?? 500;
    return res.status(status).json({ message: err.message });
  }
}

module.exports = { triggerWorkflowRun };

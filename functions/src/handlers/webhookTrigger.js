/**
 * webhookTrigger handler.
 *
 * External systems call POST /webhook/:workflow_id to start a workflow run
 * without a logged-in user. Authentication is via a per-trigger secret token
 * stored in workflow_triggers.config.secret for triggers of type='webhook'.
 *
 * Token is passed as the x-webhook-secret request header.
 *
 * Auth model:
 *   - Only org owners can create a webhook trigger (enforced by Hasura
 *     insert permission on workflow_triggers, type _nin webhook for editors).
 *   - A valid token therefore represents an owner-authorized external caller.
 *   - callerRole is set to 'owner' so db_write/notify steps run normally.
 *
 * Security:
 *   - crypto.timingSafeEqual is used to prevent timing attacks.
 *   - Length mismatch returns 401 BEFORE calling timingSafeEqual, because
 *     timingSafeEqual throws a TypeError if buffer lengths differ.
 */

const crypto = require('crypto');
const { adminQuery } = require('../hasura');
const { executeRun } = require('../executeRun');

async function webhookTrigger(req, res) {
  try {
    const { workflow_id: workflowId } = req.params;
    const providedSecret = req.headers['x-webhook-secret'];

    // ── 1. Basic input presence ────────────────────────────────────────────
    if (!workflowId) {
      return res.status(400).json({ message: 'workflow_id is required in URL' });
    }
    if (!providedSecret) {
      return res.status(401).json({ message: 'Missing x-webhook-secret header' });
    }

    // ── 2. Look up the workflow's webhook trigger and its secret ───────────
    const triggerData = await adminQuery(
      `query GetWebhookTrigger($workflow_id: uuid!) {
        workflow_triggers(where: {
          workflow_id: { _eq: $workflow_id },
          type:        { _eq: "webhook" }
        }, limit: 1) {
          config
          workflow { id org_id }
        }
      }`,
      { workflow_id: workflowId },
    );

    const trigger = triggerData.workflow_triggers?.[0];
    if (!trigger) {
      // Return 401, not 404 — don't reveal whether the workflow exists
      return res.status(401).json({ message: 'Invalid workflow or webhook not configured' });
    }

    const storedSecret = trigger.config?.secret;
    if (!storedSecret) {
      return res.status(500).json({ message: 'Webhook trigger has no secret configured' });
    }

    // ── 3. Constant-time secret comparison ────────────────────────────────
    //    timingSafeEqual throws if buffers have different byte lengths —
    //    check lengths first and return a clean 401 if they differ.
    const providedBuf = Buffer.from(providedSecret);
    const storedBuf = Buffer.from(storedSecret);

    if (providedBuf.length !== storedBuf.length) {
      return res.status(401).json({ message: 'Invalid webhook secret' });
    }

    const secretsMatch = crypto.timingSafeEqual(providedBuf, storedBuf);
    if (!secretsMatch) {
      return res.status(401).json({ message: 'Invalid webhook secret' });
    }

    // ── 4. Authenticated — execute the run ────────────────────────────────
    //    callerRole is 'owner': the webhook trigger itself can only be created
    //    by an owner, so a valid token implies owner-level intent.
    const orgId = trigger.workflow.org_id;
    const result = await executeRun(workflowId, orgId, 'owner');

    return res.json(result);
  } catch (err) {
    console.error('[webhookTrigger] Unhandled error:', err);
    const status = err.statusCode ?? 500;
    return res.status(status).json({ message: err.message });
  }
}

module.exports = { webhookTrigger };

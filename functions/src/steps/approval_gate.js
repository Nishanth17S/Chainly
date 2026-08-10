/**
 * approval_gate step handler.
 *
 * When this step is reached, execution HALTS.
 * The runner inspects the returned signal and:
 *  1. Updates this step_run to status='paused'
 *  2. Updates the workflow_run to status='paused'
 *  3. Returns immediately without executing further steps.
 *
 * Resume is handled by the approveStep Action handler.
 *
 * config shape: {} (no config needed — the gate itself is the signal)
 */

function executeApprovalGate() {
  // Return a well-known signal object — the runner acts on this
  return { __approval_gate__: true };
}

module.exports = { executeApprovalGate };

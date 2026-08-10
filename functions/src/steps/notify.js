/**
 * notify step handler. OWNER-ONLY step type.
 *
 * Layer-2 enforcement: only reachable if the runtime check in triggerWorkflowRun
 * confirmed this step was created by an org owner. Hasura insert permission
 * on workflow_steps already blocks editors from creating notify steps.
 *
 * For now: logs the notification payload and marks the step done.
 * The real Hasura Event Trigger will be wired in a later task.
 *
 * config shape:
 *   {
 *     channel: "email" | "slack" | "webhook",
 *     message: "...",        // may contain {{previous_output}}
 *     recipient: "..."
 *   }
 */

const { serializeOutput } = require('../utils');

function interpolate(value, previousOutput) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{previous_output\}\}/g, serializeOutput(previousOutput));
}

function executeNotify(config, previousOutput) {
  const message = interpolate(config.message || '(no message)', previousOutput);
  const channel = config.channel || 'log';
  const recipient = config.recipient || '(no recipient)';

  // TODO: wire real Event Trigger in next task
  console.log(`[notify] channel=${channel} recipient=${recipient} message=${message}`);

  return {
    output: {
      notified: true,
      channel,
      recipient,
      message,
      note: 'Event Trigger not yet wired — logged only',
    },
  };
}

module.exports = { executeNotify };

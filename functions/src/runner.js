/**
 * runner.js — Core step execution engine.
 *
 * Iterates an ordered list of workflow_steps, creating and updating
 * step_runs in Hasura as each step executes.
 *
 * Returns: { status: 'completed' | 'paused' | 'failed', pausedStepRunId?, error? }
 */

const { adminQuery } = require('./hasura');
const { executeLlmCall } = require('./steps/llm_call');
const { executeHttpRequest } = require('./steps/http_request');
const { executeConditionalBranch } = require('./steps/conditional_branch');
const { executeDbWrite } = require('./steps/db_write');
const { executeNotify } = require('./steps/notify');
const { executeApprovalGate } = require('./steps/approval_gate');

// Owner-only step types — enforced here as defense-in-depth (layer 2)
const OWNER_ONLY_TYPES = new Set(['db_write', 'notify', 'webhook']);

async function createStepRun(runId, stepId, status, input) {
  const data = await adminQuery(
    `mutation CreateStepRun($run_id: uuid!, $step_id: uuid!, $status: String!, $input: jsonb) {
      insert_step_runs_one(object: {
        run_id: $run_id, step_id: $step_id, status: $status, input: $input, attempt_count: 1
      }) { id }
    }`,
    { run_id: runId, step_id: stepId, status, input },
  );
  return data.insert_step_runs_one.id;
}

async function updateStepRun(stepRunId, fields) {
  const setClauses = Object.keys(fields)
    .map((k) => `${k}: $${k}`)
    .join(', ');
  const varDecls = Object.entries(fields)
    .map(([k, v]) => `$${k}: ${inferGqlType(k, v)}`)
    .join(', ');

  await adminQuery(
    `mutation UpdateStepRun($id: uuid!, ${varDecls}) {
      update_step_runs_by_pk(pk_columns: {id: $id}, _set: {${setClauses}}) { id }
    }`,
    { id: stepRunId, ...fields },
  );
}

async function updateWorkflowRun(runId, fields) {
  const setClauses = Object.keys(fields)
    .map((k) => `${k}: $${k}`)
    .join(', ');
  const varDecls = Object.entries(fields)
    .map(([k, v]) => `$${k}: ${inferGqlType(k, v)}`)
    .join(', ');

  await adminQuery(
    `mutation UpdateWorkflowRun($id: uuid!, ${varDecls}) {
      update_workflow_runs_by_pk(pk_columns: {id: $id}, _set: {${setClauses}}) { id }
    }`,
    { id: runId, ...fields },
  );
}

// Simple type inference for GraphQL variable declarations
function inferGqlType(key, value) {
  if (key === 'attempt_count') return 'Int';
  if (key.endsWith('_at')) return 'timestamptz';
  if (typeof value === 'number') return 'Int';
  if (typeof value === 'object' && value !== null) return 'jsonb';
  return 'String';
}

/**
 * Main runner. Called by both triggerWorkflowRun (fresh run) and
 * approveStep (resume from paused gate).
 *
 * @param {string}  runId               - workflow_run.id
 * @param {Array}   steps               - ordered array of workflow_step objects
 * @param {object}  runnerContext        - { callerRole, initialPreviousOutput }
 * @returns {{ status, pausedStepRunId, error }}
 */
async function runner(runId, steps, runnerContext = {}) {
  // On resume, seed from the last completed step's output so
  // {{previous_output}} in the first post-gate step resolves correctly.
  let previousOutput = runnerContext.initialPreviousOutput ?? null;
  let stepIndex = 0;

  while (stepIndex < steps.length) {
    const step = steps[stepIndex];
    const config = step.config || {};
    const stepType = step.type;

    // Layer-2 runtime check: owner-only step types
    if (OWNER_ONLY_TYPES.has(stepType) && runnerContext.callerRole !== 'owner') {
      const errMsg = `Step type '${stepType}' is owner-only. Caller role: ${runnerContext.callerRole}`;
      console.warn(`[runner] ${errMsg}`);
      await updateWorkflowRun(runId, { status: 'failed' });
      return { status: 'failed', error: errMsg };
    }

    // Create step_run with 'running' status
    const stepRunId = await createStepRun(runId, step.id, 'running', previousOutput);

    let output = null;
    let attemptCount = 1;
    let failed = false;
    let failError = null;
    let nextStepOrder = null; // for conditional_branch jumps

    try {
      switch (stepType) {
        case 'llm_call': {
          const result = await executeLlmCall(config, previousOutput);
          output = result.output;
          attemptCount = result.attemptCount;
          break;
        }
        case 'http_request': {
          const result = await executeHttpRequest(config, previousOutput);
          output = result.output;
          attemptCount = result.attemptCount;
          break;
        }
        case 'conditional_branch': {
          const result = executeConditionalBranch(config, previousOutput);
          output = result.output;
          nextStepOrder = result.nextStepOrder;
          break;
        }
        case 'db_write': {
          output = await executeDbWrite(config, previousOutput);
          break;
        }
        case 'notify': {
          output = executeNotify(config, previousOutput);
          break;
        }
        case 'approval_gate': {
          const signal = executeApprovalGate();
          // Signal the pause
          await updateStepRun(stepRunId, { status: 'paused', output: signal });
          await updateWorkflowRun(runId, { status: 'paused' });
          return { status: 'paused', pausedStepRunId: stepRunId };
        }
        default:
          throw new Error(`Unknown step type: ${stepType}`);
      }
    } catch (err) {
      failed = true;
      failError = err.message;
    }

    if (failed) {
      await updateStepRun(stepRunId, {
        status: 'failed',
        error: failError,
        attempt_count: attemptCount,
      });
      await updateWorkflowRun(runId, { status: 'failed' });
      return { status: 'failed', error: failError };
    }

    // Step succeeded — persist output
    await updateStepRun(stepRunId, {
      status: 'done',
      output,
      attempt_count: attemptCount,
    });

    previousOutput = output;

    // Handle conditional_branch jump
    if (nextStepOrder !== null) {
      const jumpIndex = steps.findIndex((s) => s.step_order === nextStepOrder);
      if (jumpIndex === -1) {
        // Branch target not found — treat as end of workflow
        break;
      }
      stepIndex = jumpIndex;
    } else {
      stepIndex++;
    }
  }

  // All steps complete
  await updateWorkflowRun(runId, { status: 'completed' });
  return { status: 'completed' };
}

module.exports = { runner };

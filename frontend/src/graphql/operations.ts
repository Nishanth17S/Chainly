// operations.ts
// These template strings can be wrapped with `gql` tag from urql or Apollo later.

export const GET_ORG_WORKFLOWS = `
  query GetOrgWorkflows($org_id: uuid!) {
    workflows(where: { org_id: { _eq: $org_id } }) {
      id
      name
      created_at
      steps(order_by: { step_order: asc }) {
        id
        type
        step_order
        config
      }
      triggers {
        id
        type
        config
      }
      runs(order_by: { created_at: desc }, limit: 1) {
        id
        status
        created_at
      }
    }
  }
`;

export const WATCH_RUN = `
  subscription WatchRun($run_id: uuid!) {
    step_runs(where: { run_id: { _eq: $run_id } }, order_by: { created_at: asc }) {
      id
      status
      output
      error
      approved_by
      approved_at
      step {
        type
        step_order
      }
    }
  }
`;

export const GET_ORG_USAGE = `
  query GetOrgUsage($org_id: uuid!) {
    organizations_by_pk(id: $org_id) {
      id
      name
      calls_allowed
      calls_used
      monthly_usage {
        runs_this_month
      }
    }
  }
`;

export const CREATE_WORKFLOW = `
  mutation CreateWorkflow($object: workflows_insert_input!) {
    insert_workflows_one(object: $object) {
      id
      name
    }
  }
`;

export const RUN_WORKFLOW = `
  mutation RunWorkflow($workflow_id: String!) {
    triggerWorkflowRun(workflow_id: $workflow_id) {
      run_id
    }
  }
`;

export const APPROVE_STEP = `
  mutation ApproveStep($step_run_id: String!) {
    approveStep(step_run_id: $step_run_id) {
      run_id
      status
      error
    }
  }
`;



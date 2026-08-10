require('dotenv').config();
const { WebSocket } = require('ws');
const { createClient } = require('graphql-ws');

const ENDPOINT = process.env.HASURA_GRAPHQL_ENDPOINT;
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;

const ORG_ID = '00000000-0000-0000-0000-00000000000a';

const GET_ORG_WORKFLOWS = `
  query GetOrgWorkflows($org_id: uuid!) {
    workflows(where: { org_id: { _eq: $org_id } }) {
      id name created_at
      steps(order_by: { step_order: asc }) { id type step_order config }
      triggers { id type config }
      runs(order_by: { created_at: desc }, limit: 1) { id status created_at }
    }
  }
`;

const GET_ORG_USAGE = `
  query GetOrgUsage($org_id: uuid!) {
    organizations_by_pk(id: $org_id) {
      id name calls_allowed calls_used
      monthly_usage { runs_this_month }
    }
  }
`;

const WATCH_RUN = `
  subscription WatchRun($run_id: uuid!) {
    step_runs(where: { run_id: { _eq: $run_id } }, order_by: { created_at: asc }) {
      id status output error approved_by approved_at
      step { type step_order }
    }
  }
`;

async function fetchGql(query, variables, additionalHeaders = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
      ...additionalHeaders
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

async function main() {
  console.log('--- 1. Testing GET_ORG_WORKFLOWS ---');
  const workflowsData = await fetchGql(GET_ORG_WORKFLOWS, { org_id: ORG_ID });
  console.log(JSON.stringify(workflowsData, null, 2));

  console.log('\n--- 2. Testing GET_ORG_USAGE ---');
  const usageData = await fetchGql(GET_ORG_USAGE, { org_id: ORG_ID });
  console.log(JSON.stringify(usageData, null, 2));

  console.log('\n--- 3. Testing WATCH_RUN Subscription ---');
  
  // Set up WebSocket client
  const wsEndpoint = ENDPOINT.replace('http', 'ws');
  const client = createClient({
    webSocketImpl: WebSocket,
    url: wsEndpoint,
    connectionParams: {
      headers: {
        'x-hasura-admin-secret': ADMIN_SECRET
      }
    }
  });

  // First, get the workflow ID to trigger a new run (pick one with steps)
  const workflowToRun = workflowsData.workflows.find(w => w.steps.length > 0);
  const workflowId = workflowToRun?.id;
  if (!workflowId) {
    console.log('No workflows found to trigger.');
    return;
  }

  // Trigger a new run (needs session headers since it's an Action)
  console.log(`Triggering a new run for workflow: ${workflowId}...`);
  const TRIGGER_RUN = `
    mutation {
      triggerWorkflowRun(workflow_id: "${workflowId}") {
        run_id
        status
      }
    }
  `;
  const triggerData = await fetchGql(TRIGGER_RUN, {}, {
    'x-hasura-role': 'owner',
    'x-hasura-org-id': ORG_ID,
    'x-hasura-user-id': '10000000-0000-0000-0000-00000000000a'
  });
  const newRunId = triggerData.triggerWorkflowRun.run_id;
  console.log(`New run started: ${newRunId}. Subscribing to events...`);
  
  let eventCount = 0;
  
  const unsubscribe = client.subscribe(
    {
      query: WATCH_RUN,
      variables: { run_id: newRunId },
    },
    {
      next: (data) => {
        eventCount++;
        console.log(`\n[Subscription Event #${eventCount}]`);
        // Just print the number of steps and the latest status to avoid blowing up the console
        const steps = data.data.step_runs;
        console.log(`Total step_runs: ${steps.length}`);
        steps.forEach(s => {
           console.log(`  - Step ${s.step.step_order} (${s.step.type}): ${s.status}`);
        });
      },
      error: (err) => console.error('Subscription error:', err),
      complete: () => console.log('Subscription complete'),
    }
  );

  // Keep alive for a bit so the user can trigger a run
  setTimeout(() => {
    console.log('\nClosing subscription after 30 seconds.');
    unsubscribe();
    process.exit(0);
  }, 30000);
}

main().catch(console.error);

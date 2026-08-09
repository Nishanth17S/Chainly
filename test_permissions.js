const fs = require('fs');
require('dotenv').config();

const { setGlobalDispatcher, Agent } = require('undici');
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

const ENDPOINT = 'https://vgbddbwidmlmfsjvrzcg.hasura.ap-south-1.nhost.run/v1/graphql';
const ADMIN_SECRET = 'GfJdYo(L0dvC+5#Z_8@jXv*Voki=Q+y$';

async function fetchGraphQL(operationsDoc, operationName, variables, headers) {
  const result = await fetch(ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({
      query: operationsDoc,
      variables: variables,
      operationName: operationName
    }),
    headers: headers
  });

  return await result.json();
}

const adminHeaders = {
  'Content-Type': 'application/json',
  'x-hasura-admin-secret': ADMIN_SECRET
};

async function setup() {
  console.log("Setting up test data as admin...");
  const setupQuery = `
    mutation Setup {
      # 1. Create orgs
      insert_organizations(objects: [
        { name: "Org A", id: "00000000-0000-0000-0000-00000000000a" },
        { name: "Org B", id: "00000000-0000-0000-0000-00000000000b" }
      ], on_conflict: {constraint: organizations_pkey, update_columns: [name]}) { returning { id } }
      
      # 2. Create users (members)
      insert_org_members(objects: [
        { org_id: "00000000-0000-0000-0000-00000000000a", user_id: "10000000-0000-0000-0000-00000000000a", role: "owner" },
        { org_id: "00000000-0000-0000-0000-00000000000b", user_id: "10000000-0000-0000-0000-00000000000b", role: "owner" },
        { org_id: "00000000-0000-0000-0000-00000000000a", user_id: "20000000-0000-0000-0000-00000000000a", role: "editor" },
        { org_id: "00000000-0000-0000-0000-00000000000a", user_id: "30000000-0000-0000-0000-00000000000a", role: "viewer" }
      ], on_conflict: {constraint: org_members_pkey, update_columns: [role]}) { returning { id } }

      # 3. Create workflows
      insert_workflows(objects: [
        { org_id: "00000000-0000-0000-0000-00000000000a", name: "Workflow A", id: "a0000000-0000-0000-0000-000000000000" },
        { org_id: "00000000-0000-0000-0000-00000000000b", name: "Workflow B", id: "b0000000-0000-0000-0000-000000000000" }
      ], on_conflict: {constraint: workflows_pkey, update_columns: [name]}) { returning { id } }
    }
  `;
  const result = await fetchGraphQL(setupQuery, 'Setup', {}, adminHeaders);
  if (result.errors) {
    console.error("Setup failed:", JSON.stringify(result.errors, null, 2));
    process.exit(1);
  }
}

async function runTests() {
  await setup();
  console.log("\n--- Running Tests ---");

  // TEST 1: Org A Editor querying Org A workflows
  const test1Headers = {
    'Content-Type': 'application/json',
    'x-hasura-admin-secret': ADMIN_SECRET,
    'x-hasura-role': 'editor',
    'x-hasura-org-id': '00000000-0000-0000-0000-00000000000a',
    'x-hasura-user-id': '20000000-0000-0000-0000-00000000000a'
  };

  const queryWorkflows = `
    query GetWorkflows {
      workflows {
        id
        name
      }
    }
  `;

  console.log("\nTEST 1: Org A Editor reading Org A workflows");
  const res1 = await fetchGraphQL(queryWorkflows, 'GetWorkflows', {}, test1Headers);
  console.log("RES1:", JSON.stringify(res1, null, 2));
  if (res1.data?.workflows?.length === 1 && res1.data.workflows[0].name === "Workflow A") {
    console.log("✅ Success: Editor can read their own org's workflows.");
  } else {
    console.log("❌ Failed.");
  }

  // TEST 2: Org A Editor trying to query Org B workflows
  const test2Headers = {
    'Content-Type': 'application/json',
    'x-hasura-admin-secret': ADMIN_SECRET,
    'x-hasura-role': 'editor',
    'x-hasura-org-id': '00000000-0000-0000-0000-00000000000b', // Spoofing Org B
    'x-hasura-user-id': '20000000-0000-0000-0000-00000000000a'
  };

  console.log("\nTEST 2: Org A Editor attempting to read Org B workflows (spoofing x-hasura-org-id)");
  const res2 = await fetchGraphQL(queryWorkflows, 'GetWorkflows', {}, test2Headers);
  console.log("RES2:", JSON.stringify(res2, null, 2));
  if (res2.data?.workflows?.length === 0) {
    console.log("✅ Success: Editor got 0 rows (denied) when trying to access Org B.");
  } else {
    console.log("❌ Failed.");
  }

  // TEST 3: Org A Viewer trying to insert a workflow run
  const test3Headers = {
    'Content-Type': 'application/json',
    'x-hasura-admin-secret': ADMIN_SECRET,
    'x-hasura-role': 'viewer',
    'x-hasura-org-id': '00000000-0000-0000-0000-00000000000a',
    'x-hasura-user-id': '30000000-0000-0000-0000-00000000000a'
  };

  const insertRun = `
    mutation InsertRun {
      insert_workflow_runs_one(object: {
        workflow_id: "a0000000-0000-0000-0000-000000000000",
        status: "pending"
      }) {
        id
      }
    }
  `;

  console.log("\nTEST 3: Org A Viewer attempting to insert a workflow run");
  const res3 = await fetchGraphQL(insertRun, 'InsertRun', {}, test3Headers);
  console.log(JSON.stringify(res3, null, 2));
  if (res3.errors && res3.errors.some(e => e.message.includes("not found in type: 'mutation_root'"))) {
    console.log("✅ Success: Viewer lacks mutation permissions (mutation_root error) to insert runs.");
  } else if (res3.errors) {
    console.log("✅ Success: Insert rejected (other GraphQL error).");
  } else {
    console.log("❌ Failed: Run was inserted!");
  }
}

runTests().catch(console.error);
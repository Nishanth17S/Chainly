// Thin admin-secret GraphQL client for talking back to Hasura
const HASURA_ENDPOINT = process.env.HASURA_GRAPHQL_ENDPOINT;
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;

if (!HASURA_ENDPOINT || !ADMIN_SECRET) {
  throw new Error('Missing HASURA_GRAPHQL_ENDPOINT or HASURA_ADMIN_SECRET in environment');
}

// Strip /v1/graphql suffix if present, then re-add it
const BASE = HASURA_ENDPOINT.replace(/\/v1\/graphql$/, '');
const GQL_URL = `${BASE}/v1/graphql`;

/**
 * Execute a GraphQL operation against Hasura with admin privileges.
 * Throws if the response contains errors.
 */
async function adminQuery(query, variables = {}) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors && json.errors.length > 0) {
    const msg = json.errors.map((e) => e.message).join('; ');
    throw new Error(`Hasura error: ${msg}`);
  }

  return json.data;
}

module.exports = { adminQuery };

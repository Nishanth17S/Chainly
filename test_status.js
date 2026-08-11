fetch('https://vgbddbwidmlmfsjvrzcg.hasura.ap-south-1.nhost.run/v1/graphql', {
  method: 'POST',
  headers: {
    'x-hasura-admin-secret': 'GfJdYo(L0dvC+5#Z_8@jXv*Voki=Q+y$'
  },
  body: JSON.stringify({
    query: `
      {
        step_runs(limit: 10, order_by: {created_at: desc}) {
          id
          status
          step {
            step_order
          }
        }
      }
    `
  })
}).then(r => r.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(console.error);

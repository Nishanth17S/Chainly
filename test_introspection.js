fetch('https://vgbddbwidmlmfsjvrzcg.hasura.ap-south-1.nhost.run/v1/graphql', {
  method: 'POST',
  headers: {
    'x-hasura-admin-secret': 'GfJdYo(L0dvC+5#Z_8@jXv*Voki=Q+y$',
    'x-hasura-role': 'user'
  },
  body: JSON.stringify({
    query: `
      {
        __type(name: "org_members") {
          fields {
            name
          }
        }
      }
    `
  })
}).then(r => r.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(console.error);

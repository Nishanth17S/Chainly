'use client';

import React, { useMemo } from 'react';
import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { useUserData, useAccessToken } from '@nhost/react';
import { useOrgContext } from '@/context/OrgContext';

export function ApolloAppProvider({ children }: { children: React.ReactNode }) {
  const token = useAccessToken();
  const user = useUserData();
  const { selectedOrgId, selectedRole } = useOrgContext();

  // Use a ref so the authLink always has the freshest values without needing to recreate the ApolloClient entirely
  const authState = React.useRef({ token, selectedOrgId, selectedRole });
  authState.current = { token, selectedOrgId, selectedRole };

  const client = useMemo(() => {
    // Determine the base URL for HTTP and WS from Nhost config, or hardcode for now
    const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'vgbddbwidmlmfsjvrzcg';
    const region = process.env.NEXT_PUBLIC_NHOST_REGION || 'ap-south-1';
    
    const httpUrl = `https://${subdomain}.hasura.${region}.nhost.run/v1/graphql`;
    const wsUrl = `wss://${subdomain}.hasura.${region}.nhost.run/v1/graphql`;

    const httpLink = new HttpLink({
      uri: httpUrl,
    });

    const authLink = setContext((_, { headers }) => {
      const { token, selectedOrgId, selectedRole } = authState.current;
      // Dynamic headers evaluated on every HTTP request
      const outgoingHeaders = {
        ...headers,
        authorization: token ? `Bearer ${token}` : '',
        ...(selectedRole ? { 'x-hasura-role': selectedRole } : {}),
      };
      
      console.log('Apollo HTTP Request Headers going out:', outgoingHeaders);
      
      return {
        headers: outgoingHeaders,
      };
    });

    const wsLink = new GraphQLWsLink(
      createClient({
        url: wsUrl,
        connectionParams: () => {
          const { token, selectedOrgId, selectedRole } = authState.current;
          // Evaluated when the socket connects
          return {
            headers: {
              authorization: token ? `Bearer ${token}` : '',
              ...(selectedRole ? { 'x-hasura-role': selectedRole } : {}),
            },
          };
        },
      })
    );

    // Split based on operation type
    const splitLink = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      authLink.concat(httpLink)
    );

    return new ApolloClient({
      link: splitLink,
      cache: new InMemoryCache(),
    });
  }, []); // Initialize once, headers read dynamically via ref

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

'use client';

import React from 'react';
import { NhostProvider } from '@nhost/react';
import { nhost } from '@/lib/nhost';
import { OrgProvider } from '@/context/OrgContext';
import { ApolloAppProvider } from '@/lib/apolloProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NhostProvider nhost={nhost}>
      <OrgProvider>
        <ApolloAppProvider>
          {children}
        </ApolloAppProvider>
      </OrgProvider>
    </NhostProvider>
  );
}

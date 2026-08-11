'use client';

import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useOrgContext } from '@/context/OrgContext';
import { GET_ORG_WORKFLOWS } from '@/graphql/operations';
import { WorkflowList } from './WorkflowList';
import { WorkflowBuilder } from './WorkflowBuilder';
import { Loader2, Plus } from 'lucide-react';

export function WorkflowsContainer() {
  const { selectedOrgId, selectedRole } = useOrgContext();
  const [isBuilding, setIsBuilding] = useState(false);

  const { data, loading, error, refetch } = useQuery<{ workflows: any[] }>(gql(GET_ORG_WORKFLOWS), {
    variables: { org_id: selectedOrgId },
    skip: !selectedOrgId,
    fetchPolicy: 'cache-and-network',
  });

  const isViewer = selectedRole === 'viewer';

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Error loading workflows: {error.message}
      </div>
    );
  }

  if (isBuilding) {
    return (
      <WorkflowBuilder 
        onCancel={() => setIsBuilding(false)} 
        onSuccess={() => {
          setIsBuilding(false);
          refetch();
        }} 
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Workflows</h2>
        {!isViewer && (
          <button 
            onClick={() => setIsBuilding(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Workflow
          </button>
        )}
      </div>

      <WorkflowList workflows={data?.workflows || []} />
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useOrgContext } from '@/context/OrgContext';
import { RUN_WORKFLOW } from '@/graphql/operations';
import { WorkflowRunPanel } from './WorkflowRunPanel';
import { Play, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

type Workflow = {
  id: string;
  name: string;
  created_at: string;
  steps: { id: string; type: string }[];
  triggers: { id: string; type: string }[];
  runs: { id: string; status: string; created_at: string }[];
};

export function WorkflowList({ workflows }: { workflows: Workflow[] }) {
  const { selectedRole } = useOrgContext();
  const isViewer = selectedRole === 'viewer';
  
  const [runWorkflow, { loading: isRunning }] = useMutation<{ triggerWorkflowRun: { run_id: string } }>(gql(RUN_WORKFLOW));
  const [activeRunIds, setActiveRunIds] = useState<Record<string, string>>({});
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const handleRun = async (workflowId: string) => {
    try {
      const { data } = await runWorkflow({ variables: { workflow_id: workflowId } });
      if (data?.triggerWorkflowRun?.run_id) {
        const runId = data.triggerWorkflowRun.run_id;
        setActiveRunIds(prev => ({ ...prev, [workflowId]: runId }));
        setExpandedCards(prev => ({ ...prev, [workflowId]: true }));
      }
    } catch (e) {
      console.error('Failed to trigger run:', e);
      alert('Failed to trigger workflow run.');
    }
  };

  const toggleExpand = (workflowId: string, fallbackRunId?: string) => {
    setExpandedCards(prev => {
      const isExpanded = !prev[workflowId];
      if (isExpanded && !activeRunIds[workflowId] && fallbackRunId) {
        // Automatically set the latest run if we expand and don't have an active one
        setActiveRunIds(current => ({ ...current, [workflowId]: fallbackRunId }));
      }
      return { ...prev, [workflowId]: isExpanded };
    });
  };

  if (workflows.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">No workflows</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new workflow.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {workflows.map((workflow) => (
        <div key={workflow.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-100 hover:border-blue-300 transition-colors">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 truncate">
              {workflow.name}
            </h3>
            <div className="mt-2 text-sm text-gray-500 space-y-1">
              <p>Steps: <span className="font-medium text-gray-900">{workflow.steps.length}</span></p>
              <p>Triggers: <span className="font-medium text-gray-900">{workflow.triggers.map(t => t.type).join(', ') || 'None'}</span></p>
              <p>Latest Run: 
                <span className={`ml-1 font-medium capitalize ${
                  workflow.runs[0]?.status === 'completed' ? 'text-green-600' :
                  workflow.runs[0]?.status === 'failed' ? 'text-red-600' :
                  workflow.runs[0]?.status === 'paused' ? 'text-yellow-600' : 'text-gray-900'
                }`}>
                  {workflow.runs[0]?.status || 'Never run'}
                </span>
              </p>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between items-center">
            <button 
              onClick={() => toggleExpand(workflow.id, workflow.runs[0]?.id)}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center"
              disabled={!workflow.runs[0] && !activeRunIds[workflow.id]}
            >
              {expandedCards[workflow.id] ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
              {activeRunIds[workflow.id] ? 'View Live Run' : 'History'}
            </button>
            
            {!isViewer && (
              <button 
                onClick={() => handleRun(workflow.id)}
                disabled={isRunning}
                className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isRunning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1 fill-current" />}
                Run
              </button>
            )}
          </div>
          
          {expandedCards[workflow.id] && activeRunIds[workflow.id] && (
            <WorkflowRunPanel runId={activeRunIds[workflow.id]} />
          )}
        </div>
      ))}
    </div>
  );
}

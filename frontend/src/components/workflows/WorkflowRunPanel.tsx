'use client';

import React from 'react';
import { gql } from '@apollo/client';
import { useSubscription, useMutation } from '@apollo/client/react';
import { useOrgContext } from '@/context/OrgContext';
import { WATCH_RUN, APPROVE_STEP } from '@/graphql/operations';
import { Loader2, CheckCircle2, XCircle, PauseCircle, PlayCircle } from 'lucide-react';

export function WorkflowRunPanel({ runId }: { runId: string }) {
  const { selectedRole } = useOrgContext();
  const isViewer = selectedRole === 'viewer';
  
  const { data, loading, error } = useSubscription<{ step_runs: any[] }>(gql(WATCH_RUN), {
    variables: { run_id: runId },
  });

  const [approveStep, { loading: approvingId }] = useMutation<{ approveStep: { run_id: string; status: string; error: string | null } }>(gql(APPROVE_STEP));

  const handleApprove = async (stepRunId: string) => {
    try {
      await approveStep({ variables: { step_run_id: stepRunId } });
    } catch (e) {
      console.error('Failed to approve step', e);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center p-6 bg-gray-50 border-t border-gray-100">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 text-sm border-t border-red-100">
        Error loading live status: {error.message}
      </div>
    );
  }

  const stepRuns = data?.step_runs || [];

  if (stepRuns.length === 0) {
    return (
      <div className="p-6 bg-gray-50 text-center text-sm text-gray-500 border-t border-gray-100">
        Waiting for steps to start...
      </div>
    );
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'done':
        return <span className="flex items-center text-green-600 font-medium"><CheckCircle2 className="w-4 h-4 mr-1" /> Done</span>;
      case 'failed':
        return <span className="flex items-center text-red-600 font-medium"><XCircle className="w-4 h-4 mr-1" /> Failed</span>;
      case 'running':
        return <span className="flex items-center text-blue-600 font-medium"><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Running</span>;
      case 'paused':
        return <span className="flex items-center text-amber-600 font-medium"><PauseCircle className="w-4 h-4 mr-1" /> Paused</span>;
      default:
        return <span className="flex items-center text-gray-500 font-medium"><PlayCircle className="w-4 h-4 mr-1" /> Pending</span>;
    }
  };

  return (
    <div className="bg-gray-50 border-t border-gray-100 p-4 space-y-3 rounded-b-lg">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Live Run Status</h4>
      {stepRuns.map((sr: any) => (
        <div key={sr.id} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-600">
              {sr.step.step_order}
            </span>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md font-medium capitalize">
              {sr.step.type.replace('_', ' ')}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm">
              {getStatusDisplay(sr.status)}
            </div>
            
            {!isViewer && sr.status === 'paused' && (
              <button 
                onClick={() => handleApprove(sr.id)}
                disabled={approvingId}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded shadow-sm transition-colors flex items-center disabled:opacity-50"
              >
                Approve
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

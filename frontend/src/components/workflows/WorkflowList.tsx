'use client';

import React from 'react';

type Workflow = {
  id: string;
  name: string;
  created_at: string;
  steps: { id: string; type: string }[];
  triggers: { id: string; type: string }[];
  runs: { id: string; status: string; created_at: string }[];
};

export function WorkflowList({ workflows }: { workflows: Workflow[] }) {
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
          <div className="bg-gray-50 px-4 py-4 sm:px-6">
            <div className="text-sm">
              <button className="font-medium text-blue-600 hover:text-blue-500 mr-4">View</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

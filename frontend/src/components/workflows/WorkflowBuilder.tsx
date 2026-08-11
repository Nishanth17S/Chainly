'use client';

import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useOrgContext } from '@/context/OrgContext';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { CREATE_WORKFLOW } from '@/graphql/operations';

type StepDraft = {
  id: string;
  type: string;
  configString: string;
  configError?: string;
};

type TriggerDraft = {
  id: string;
  type: string;
  secret?: string;
};

export function WorkflowBuilder({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: () => void }) {
  const { selectedOrgId, selectedRole } = useOrgContext();
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [triggers, setTriggers] = useState<TriggerDraft[]>([]);
  const [createWorkflow, { loading, error }] = useMutation<{ insert_workflows_one: { id: string; name: string } }>(gql(CREATE_WORKFLOW));

  const isOwner = selectedRole === 'owner';

  // Step Options based on Role
  const allStepTypes = [
    { value: 'llm_call', label: 'LLM Call' },
    { value: 'http_request', label: 'HTTP Request' },
    { value: 'conditional_branch', label: 'Conditional Branch' },
    { value: 'approval_gate', label: 'Approval Gate' },
    { value: 'db_write', label: 'DB Write (Owner only)', restricted: true },
    { value: 'notify', label: 'Notify (Owner only)', restricted: true },
  ];

  const allowedStepTypes = allStepTypes.filter(t => isOwner || !t.restricted);

  const addStep = () => {
    setSteps([...steps, { id: crypto.randomUUID(), type: allowedStepTypes[0].value, configString: '{\n  \n}' }]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === steps.length - 1) return;
    const newSteps = [...steps];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];
    setSteps(newSteps);
  };

  const updateStep = (id: string, updates: Partial<StepDraft>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const validateStepJson = (id: string, jsonString: string) => {
    try {
      if (jsonString.trim()) JSON.parse(jsonString);
      updateStep(id, { configString: jsonString, configError: undefined });
    } catch (e: any) {
      updateStep(id, { configString: jsonString, configError: e.message });
    }
  };

  const addTrigger = (type: string) => {
    const trigger: TriggerDraft = { id: crypto.randomUUID(), type };
    if (type === 'webhook') {
      const array = new Uint8Array(16);
      window.crypto.getRandomValues(array);
      const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
      trigger.secret = `wh_${hex}`;
    }
    setTriggers([...triggers, trigger]);
  };

  const removeTrigger = (id: string) => {
    setTriggers(triggers.filter(t => t.id !== id));
  };

  const handleSave = async () => {
    if (!name.trim()) return alert("Workflow name is required");
    
    const hasErrors = steps.some(s => s.configError);
    if (hasErrors) return alert("Please fix JSON formatting errors in your steps before saving.");

    const formattedSteps = steps.map((s, index) => {
      let config = {};
      if (s.configString.trim()) {
        config = JSON.parse(s.configString);
      }
      return {
        type: s.type,
        step_order: index + 1, // Enforces array position as order
        config
      };
    });

    const formattedTriggers = triggers.map(t => {
      const config = t.type === 'webhook' ? { secret: t.secret } : {};
      return {
        type: t.type,
        config
      };
    });

    try {
      await createWorkflow({
        variables: {
          object: {
            name,
            org_id: selectedOrgId,
            steps: { data: formattedSteps },
            triggers: { data: formattedTriggers }
          }
        }
      });
      onSuccess();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-4xl mx-auto border border-gray-100">
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <h2 className="text-xl font-bold text-gray-900">Create New Workflow</h2>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">Cancel</button>
      </div>

      <div className="space-y-8">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Workflow Name</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Customer Onboarding"
            className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Triggers Section */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium text-gray-900">Triggers</h3>
            <div className="flex gap-2">
              <button onClick={() => addTrigger('manual')} className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-medium transition-colors">
                + Manual Trigger
              </button>
              {isOwner && (
                <button onClick={() => addTrigger('webhook')} className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-medium transition-colors">
                  + Webhook Trigger
                </button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {triggers.length === 0 && <p className="text-sm text-gray-500 italic">No triggers added. Workflow can only be run internally.</p>}
            {triggers.map((trigger) => (
              <div key={trigger.id} className="p-4 border rounded-md bg-gray-50 flex justify-between items-start">
                <div>
                  <span className="font-semibold text-gray-800 capitalize">{trigger.type} Trigger</span>
                  {trigger.type === 'webhook' && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      <strong>Secret generated:</strong> <code className="bg-yellow-100 px-1 py-0.5 rounded ml-1">{trigger.secret}</code>
                      <p className="mt-1 text-xs">Copy this secret now! It will be used to authenticate incoming webhooks and won't be shown again.</p>
                    </div>
                  )}
                </div>
                <button onClick={() => removeTrigger(trigger.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Steps Section */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium text-gray-900">Steps</h3>
            <button onClick={addStep} className="text-sm px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded font-medium flex items-center transition-colors">
              <Plus className="w-4 h-4 mr-1" /> Add Step
            </button>
          </div>
          
          <div className="space-y-4">
            {steps.length === 0 && <p className="text-sm text-gray-500 italic">No steps added yet.</p>}
            {steps.map((step, index) => (
              <div key={step.id} className="p-4 border rounded-md bg-white shadow-sm flex gap-4">
                {/* Controls */}
                <div className="flex flex-col items-center justify-start gap-1 pt-1">
                  <button onClick={() => moveStep(index, 'up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                  <span className="text-xs font-bold text-gray-500">{index + 1}</span>
                  <button onClick={() => moveStep(index, 'down')} disabled={index === steps.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-center">
                    <select 
                      value={step.type}
                      onChange={(e) => updateStep(step.id, { type: e.target.value })}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      {allowedStepTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <button onClick={() => removeStep(step.id)} className="text-red-500 hover:text-red-700 text-sm flex items-center"><Trash2 className="w-4 h-4 mr-1" /> Remove</button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Configuration (JSON)</label>
                    <textarea 
                      value={step.configString}
                      onChange={(e) => updateStep(step.id, { configString: e.target.value })}
                      onBlur={(e) => validateStepJson(step.id, e.target.value)}
                      rows={4}
                      className={`w-full font-mono text-sm rounded border px-3 py-2 focus:outline-none focus:ring-1 ${step.configError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`}
                    />
                    {step.configError && <p className="mt-1 text-xs text-red-600">Invalid JSON: {step.configError}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t flex justify-end gap-3 items-center">
        {error && <span className="text-sm text-red-600 font-medium mr-auto">Save failed: {error.message}</span>}
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
          Cancel
        </button>
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 flex items-center disabled:bg-blue-400"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Workflow
        </button>
      </div>
    </div>
  );
}

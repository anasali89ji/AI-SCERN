'use client';

import { Reorder, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { WorkflowStep, WorkflowStepType } from '@/lib/workflow/types';
import { WorkflowStepCard } from './WorkflowStepCard';

const STEP_TYPE_CONFIG: Record<WorkflowStepType, { label: string; color: string }> = {
  upload: { label: 'Upload Content', color: 'bg-blue-500' },
  detect: { label: 'AI Detection', color: 'bg-primary' },
  filter: { label: 'Filter Results', color: 'bg-amber-500' },
  rag: { label: 'RAG Retrieval', color: 'bg-cyan-500' },
  review: { label: 'Human Review', color: 'bg-purple-500' },
  export: { label: 'Export Report', color: 'bg-emerald-500' },
  notify: { label: 'Send Notification', color: 'bg-rose-500' },
  store: { label: 'Store Output', color: 'bg-neutral-500' },
  quarantine: { label: 'Quarantine', color: 'bg-red-500' },
};

function getDefaultConfig(type: WorkflowStepType): Record<string, unknown> {
  switch (type) {
    case 'upload': return { modality: 'image', source: 'file', allowMultiple: false };
    case 'detect': return { models: ['vit', 'clip'], useRAG: true, confidenceThreshold: 0.7 };
    case 'filter': return { minConfidence: 0.5, maxConfidence: 1.0, action: 'flag' };
    case 'rag': return { topK: 5, similarityThreshold: 0.85 };
    case 'review': return { requireApproval: true, timeoutMinutes: 30 };
    case 'export': return { format: 'pdf', includeMetadata: true, includeRawScores: false };
    case 'notify': return { channel: 'webhook', webhookUrl: '', retryOnFailure: true };
    case 'store': return { destination: 'r2', pathTemplate: 'workflows/{date}/{filename}' };
    case 'quarantine': return { bucket: 'quarantine', notifyAdmin: true };
    default: return {};
  }
}

export function WorkflowBuilder({
  initialSteps = [],
  onSave,
}: {
  initialSteps?: WorkflowStep[];
  onSave: (steps: WorkflowStep[]) => void;
}) {
  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const addStep = (type: WorkflowStepType) => {
    const newStep: WorkflowStep = {
      id: crypto.randomUUID(),
      type,
      name: STEP_TYPE_CONFIG[type].label,
      config: getDefaultConfig(type),
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
  };

  const updateStepConfig = (id: string, config: Record<string, unknown>) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, config } : s)));
  };

  return (
    <div className="flex gap-6 h-full">
      <div className="w-64 bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex-shrink-0">
        <h3 className="text-sm font-semibold text-white mb-4">Add Step</h3>
        <div className="space-y-2">
          {Object.entries(STEP_TYPE_CONFIG).map(([type, config]) => (
            <button
              key={type}
              onClick={() => addStep(type as WorkflowStepType)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors text-sm"
            >
              <div className={`w-2 h-2 rounded-full ${config.color}`} />
              {config.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 overflow-y-auto min-h-0">
        <Reorder.Group axis="y" values={steps} onReorder={setSteps} className="space-y-3">
          <AnimatePresence>
            {steps.map((step, index) => (
              <Reorder.Item key={step.id} value={step}>
                <WorkflowStepCard
                  step={step}
                  index={index}
                  isSelected={selectedStep === step.id}
                  onSelect={() => setSelectedStep(step.id)}
                  onRemove={() => removeStep(step.id)}
                  onConfigChange={(config) => updateStepConfig(step.id, config)}
                />
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>

        {steps.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
            <p className="text-sm">Click a step type on the left to start building</p>
          </div>
        )}

        {steps.length > 0 && (
          <button
            onClick={() => onSave(steps)}
            className="mt-6 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-11 px-6 transition-all"
          >
            Save Workflow
          </button>
        )}
      </div>
    </div>
  );
}

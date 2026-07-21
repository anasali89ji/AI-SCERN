import { WorkflowStep } from '@/lib/workflow/types';
import { GripVertical, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface Props {
  step: WorkflowStep;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onConfigChange: (config: Record<string, unknown>) => void;
}

export function WorkflowStepCard({ step, index, isSelected, onSelect, onRemove, onConfigChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={onSelect}
      className={`bg-neutral-800/50 border rounded-xl p-4 cursor-pointer transition-all ${
        isSelected ? 'border-primary ring-1 ring-primary' : 'border-neutral-700 hover:border-neutral-600'
      }`}
    >
      <div className="flex items-center gap-3">
        <GripVertical className="w-4 h-4 text-neutral-500 cursor-grab" />
        <span className="text-xs text-neutral-500 font-mono">#{index + 1}</span>
        <div className="flex-1">
          <p className="text-white font-medium text-sm">{step.name}</p>
          <p className="text-neutral-400 text-xs">{step.type}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="p-1 rounded hover:bg-neutral-700 text-neutral-400"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 rounded hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-neutral-700">
          <pre className="text-xs text-neutral-300 overflow-x-auto">
            {JSON.stringify(step.config, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export type Modality = 'text' | 'image' | 'audio' | 'video' | 'web';

export type WorkflowStepType =
  | 'upload'
  | 'detect'
  | 'filter'
  | 'rag'
  | 'review'
  | 'export'
  | 'notify'
  | 'store'
  | 'quarantine';

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  name: string;
  config: Record<string, unknown>;
  dependsOn?: string[];
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  isTemplate: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  runCount: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  stepResults: WorkflowStepResult[];
  output?: Record<string, unknown>;
  error?: string;
}

export interface WorkflowStepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  output?: Record<string, unknown>;
  error?: string;
  logs: string[];
}

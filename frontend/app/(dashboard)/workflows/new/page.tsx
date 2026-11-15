'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WorkflowBuilder } from '@/components/workflow/WorkflowBuilder';
import { WorkflowStep } from '@/lib/workflow/types';
import { useAuth } from '@/components/auth-provider';
import { toast } from 'sonner';

// Supabase browser client (~169 kB raw / ~50 kB gz) is only needed when saving
// a workflow; importing it on demand keeps it out of this route's initial
// bundle (2026-11 audit, PERF-B4).
async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/client');
  return createClient();
}

export default function NewWorkflowPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');

  const handleSave = async (steps: WorkflowStep[]) => {
    if (!name.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }
    if (!user?.uid) {
      toast.error('You must be signed in');
      return;
    }

    const supabase = await getSupabase();
    const { error } = await supabase.from('workflows').insert({
      user_id: user.uid,
      name: name.trim(),
      steps,
      is_template: false,
      is_active: true,
    });

    if (error) {
      toast.error('Failed to save workflow');
      return;
    }

    toast.success('Workflow created successfully');
    router.push('/workflows');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">New Workflow</h1>
        <input
          type="text"
          placeholder="Workflow name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-neutral-800/50 border border-neutral-700 text-white rounded-xl h-10 px-4 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all flex-1 max-w-md"
        />
      </div>
      <div className="flex-1 min-h-0">
        <WorkflowBuilder onSave={handleSave} />
      </div>
    </div>
  );
}

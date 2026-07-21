'use client';

import Link from 'next/link';
import { Plus, GitBranch, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth-provider';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function WorkflowsPage() {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!user?.uid) return;
    supabase
      .from('workflows')
      .select('*')
      .eq('user_id', user.uid)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setWorkflows(data || []);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Workflows</h1>
        <Link
          href="/workflows/new"
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-10 px-4 transition-all"
        >
          <Plus className="w-4 h-4" /> New Workflow
        </Link>
      </div>

      {workflows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No workflows yet"
          description="Create your first workflow to automate detection pipelines."
          action={
            <Link
              href="/workflows/new"
              className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-10 px-4 inline-flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Workflow
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between hover:border-neutral-700 transition-colors"
            >
              <div>
                <h3 className="text-white font-semibold">{wf.name}</h3>
                <p className="text-neutral-400 text-sm">{wf.description || 'No description'}</p>
                <p className="text-neutral-500 text-xs mt-1">{wf.steps.length} steps · {wf.run_count} runs</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/workflows/${wf.id}/run`}
                  className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
                >
                  <Play className="w-4 h-4" />
                </Link>
                <Link
                  href={`/workflows/${wf.id}`}
                  className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors text-sm px-3"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

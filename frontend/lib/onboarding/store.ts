import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export async function getOnboardingState(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('has_completed_onboarding, onboarding_skipped_at, onboarding_use_case, onboarding_step_reached')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Failed to fetch onboarding state:', error);
    return null;
  }

  return data;
}

export async function completeOnboarding(userId: string, useCase?: string) {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      has_completed_onboarding: true,
      onboarding_use_case: useCase ?? null,
      onboarding_step_reached: 4,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to complete onboarding:', error);
    throw error;
  }
}

export async function skipOnboarding(userId: string) {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      onboarding_skipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to skip onboarding:', error);
    throw error;
  }
}

export async function updateOnboardingStep(userId: string, step: number, useCase?: string) {
  const update: Record<string, unknown> = {
    onboarding_step_reached: step,
    updated_at: new Date().toISOString(),
  };
  if (useCase) update.onboarding_use_case = useCase;

  const { error } = await supabase
    .from('user_profiles')
    .update(update)
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to update onboarding step:', error);
    throw error;
  }
}

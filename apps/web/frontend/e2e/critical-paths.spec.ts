import { test, expect } from '@playwright/test';

// NOTE: the previous version of this test targeted a flow that doesn't
// match the shipped implementation — `/sign-up` (real route: `/signup`),
// a `dashboard?onboarding=true` redirect (the app never produces that URL;
// onboarding is a modal overlay gated on `profiles.onboarding_completed`,
// not a query param), and copy ("Welcome aboard", "Content Creator") that
// doesn't exist in OnboardingWizard.tsx. Rewritten to match what's real.

test('new user completes signup and onboarding, then reaches a real feature', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel(/email address/i).fill(`test-${Date.now()}@example.com`);
  await page.getByLabel(/^password$/i).fill('TestPassword123!');
  await page.getByRole('button', { name: /continue|sign up/i }).click();

  // New user with onboarding_completed=false lands on /dashboard and the
  // wizard overlay appears automatically (no query param involved).
  await page.waitForURL('/dashboard');
  await expect(page.getByText('Welcome to Aiscern')).toBeVisible();

  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('button', { name: 'Text' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: /go to dashboard/i }).click();

  // Wizard must actually disappear on success, and not reappear on reload.
  await expect(page.getByText('Welcome to Aiscern')).not.toBeVisible();
  await page.reload();
  await expect(page.getByText('Welcome to Aiscern')).not.toBeVisible();

  await page.goto('/detect/text');
  await page.locator('textarea').fill('This is a test paragraph for AI detection.');
  await page.getByRole('button', { name: /analyze/i }).click();
  await expect(page.getByText(/confidence/i)).toBeVisible({ timeout: 30000 });

  await page.goto('/history');
  await expect(page.getByText('This is a test paragraph')).toBeVisible();
});

test('returning user with completed onboarding is never shown the wizard', async ({ page }) => {
  // Assumes a seeded/authenticated user fixture with onboarding_completed=true.
  await page.goto('/dashboard');
  await expect(page.getByText('Welcome to Aiscern')).not.toBeVisible();
});

test('onboarding save failure keeps the wizard open with a retry, not a false completion', async ({ page }) => {
  await page.route('**/api/profiles/update', route => route.fulfill({ status: 500, body: '{}' }));

  await page.goto('/dashboard'); // assumes an onboarding_completed=false user fixture
  await expect(page.getByText('Welcome to Aiscern')).toBeVisible();

  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: /go to dashboard/i }).click();

  await expect(page.getByText(/couldn.t save your setup/i)).toBeVisible();
  await expect(page.getByText('Welcome to Aiscern')).toBeVisible(); // still open, not falsely completed
});

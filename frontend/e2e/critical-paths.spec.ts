import { test, expect } from '@playwright/test';

test('complete first-time user journey', async ({ page }) => {
  await page.goto('/sign-up');
  await page.fill('[name=emailAddress]', `test-${Date.now()}@example.com`);
  await page.fill('[name=password]', 'TestPassword123!');
  await page.click('button[type=submit]');

  await page.waitForURL('/dashboard?onboarding=true');
  await expect(page.locator('text=Welcome aboard')).toBeVisible();

  await page.click('text=Get Started');
  await page.click('text=Content Creator');
  await page.click('text=Continue');

  await page.goto('/detect/text');
  await page.fill('textarea', 'This is a test paragraph for AI detection.');
  await page.click('text=Analyze');
  await expect(page.locator('text=Confidence')).toBeVisible({ timeout: 30000 });

  await page.goto('/history');
  await expect(page.locator('text=This is a test paragraph')).toBeVisible();
});

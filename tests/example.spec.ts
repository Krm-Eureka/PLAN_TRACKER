import { test, expect } from '@playwright/test';

test.describe('IT Plan Tracker App', () => {
  test('should load the login page if unauthenticated', async ({ page }) => {
    test.skip(process.env.PLAYWRIGHT_TEST === '1' || process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === '1', 'Authentication is bypassed during Playwright tests');
    // Navigate to the root URL
    await page.goto('/');

    // NextAuth will typically redirect unauthenticated users to the sign-in page
    // We wait for the URL to change to the sign-in route
    await page.waitForURL('**/auth/signin**', { timeout: 10000 });

    // Verify that a sign-in element is visible (e.g. standard NextAuth button or custom login form)
    // Adjust this selector if your custom sign-in page uses a different button text
    const signInButton = page.locator('button', { hasText: /Sign in/i }).first();
    await expect(signInButton).toBeVisible();
  });
});

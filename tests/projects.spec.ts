import { test, expect } from '@playwright/test';

test.describe('Projects Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock NextAuth session to simulate a logged-in user
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { name: 'Test User', email: 'test@example.com', id: '1' },
          expires: '9999-12-31T23:59:59.999Z',
        }),
      });
    });

    // Mock minimal projects data (e.g. only project code, name, and status)
    await page.route('**/api/projects', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            { 
              id: 'proj-min-99', 
              project_code: 'MP-99', 
              project_name: 'Super Minimal Project', 
              status: 'Completed'
            },
          ],
        }),
      });
    });
  });

  test('should load projects page and display mocked minimal project data', async ({ page }) => {
    await page.goto('/projects');
    
    // Check if the mocked project name is visible
    await expect(page.locator('text=Super Minimal Project').first()).toBeVisible({ timeout: 10000 });
  });
});

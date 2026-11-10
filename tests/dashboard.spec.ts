import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
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

    // Mock minimal data for Dashboard
    // Returning only necessary fields to prove the component doesn't break
    await page.route('**/api/projects', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            { 
              id: 'min-proj-1', 
              project_code: 'MP-01', 
              project_name: 'Minimal Project A', 
              status: 'In Progress' 
            },
          ],
        }),
      });
    });

    await page.route('**/api/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            { 
              id: 'min-task-1', 
              project_id: 'min-proj-1', 
              task_name: 'Minimal Task 1', 
              status: 'Pending' 
            },
          ],
        }),
      });
    });
  });

  test('should load the dashboard with minimal mocked data without crashing', async ({ page }) => {
    // Navigate to the root URL (Dashboard)
    await page.goto('/');

    // Ensure it doesn't redirect to signin
    await expect(page).not.toHaveURL(/.*signin/);

    // Verify if minimal data is rendered
    // Adjust selectors based on actual dashboard layout, but generally checking for the text works
    const projectText = page.locator('text=Minimal Project A').first();
    const taskText = page.locator('text=Minimal Task 1').first();

    await expect(projectText).toBeVisible({ timeout: 15000 });
  });
});

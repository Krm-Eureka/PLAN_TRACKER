import { test, expect } from '@playwright/test';

test.describe('Tasks Page', () => {
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

    // Mock minimal tasks data
    await page.route('**/api/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            { 
              id: 'task-min-88', 
              project_id: 'proj-min-99', 
              task_name: 'Very Minimal Task Display', 
              status: 'In Progress' 
            },
          ],
        }),
      });
    });
    
    // We also need to mock projects for tasks since it probably needs a project context
    await page.route('**/api/projects', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            { id: 'proj-min-99', project_code: 'MP-99', project_name: 'Context Project' }
          ],
        })
      })
    })
  });

  test('should load tasks page and display mocked minimal task', async ({ page }) => {
    await page.goto('/tasks');
    
    // Check if the mocked task name is visible on the board or list
    await expect(page.locator('text=Very Minimal Task Display').first()).toBeVisible({ timeout: 10000 });
  });
});

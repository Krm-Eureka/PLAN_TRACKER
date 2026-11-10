import { test, expect } from '@playwright/test';

test.describe('Calendar Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock NextAuth session
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

    // Mock minimal plans/events data
    await page.route('**/api/calendar/events*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: [
            { 
              id: 'event-min-1', 
              summary: 'Minimal Calendar Event', 
              start: new Date().toISOString(), 
              end: new Date().toISOString(),
              isAllDay: true,
              source: 'personal'
            },
          ],
        }),
      });
    });

    await page.route('**/api/plans*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success', data: [] })
      });
    });
  });

  test('should load calendar page and display mocked minimal event', async ({ page }) => {
    await page.goto('/calendar');
    
    // Check if the mocked event title is visible on the calendar
    await expect(page.locator('text=Minimal Calendar Event').first()).toBeVisible({ timeout: 10000 });
  });
});

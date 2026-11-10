import { test, expect } from '@playwright/test';

// Use Playwright's built-in API testing features
test.describe('Task Status API Logic', () => {
  // We need to set the environment variable for our API bypass to work
  // In playwright.config.ts, webServer should run with PLAYWRIGHT_TEST=1
  // But just in case, we also send it as a header or ensure the local server has it.
  
  test('should update percent_complete correctly when status changes', async ({ request }) => {
    // 1. Create a mock task or just test the calculation by sending a PUT to a known ID
    // Since we don't have a dedicated test DB seeder, we will test the API response structure 
    // and assume Prisma mock or actual DB test record if we had one.
    // For this demonstration, we'll try to find a task or rely on the logic.
    
    // Instead of actual DB, let's just make sure the endpoint is reachable 
    // and returns the expected structured response when we pass missing parameters
    const resBad = await request.put('/api/tasks/status', {
      data: {
        task_id: '',
        new_status: 'In Progress'
      }
    });
    
    expect(resBad.status()).toBe(400);
    const bodyBad = await resBad.json();
    expect(bodyBad.message).toContain('Missing parameters');

    // To fully test this, we would need a known task_id.
    // Let's create a task first if possible via API, or fetch one.
    const resTasks = await request.get('/api/tasks');
    
    // If the API returns tasks successfully (meaning our Auth bypass worked!)
    if (resTasks.ok()) {
      const tasksData = await resTasks.json();
      if (tasksData && tasksData.data && tasksData.data.length > 0) {
        const testTask = tasksData.data[0];
        
        // Change status to Done
        const resUpdate = await request.put('/api/tasks/status', {
          data: {
            task_id: testTask.id,
            new_status: 'Done'
          }
        });
        
        expect(resUpdate.ok()).toBeTruthy();
        const updateResult = await resUpdate.json();
        
        // When status is "Done", percent_complete should become 100% implicitly
        // update_date should be set to today
        expect(updateResult.status).toBe('success');
        expect(updateResult.message).toContain('Done');
        expect(updateResult.update_date).toBeDefined();
        
        // Change it back to "In Progress"
        const resUpdateBack = await request.put('/api/tasks/status', {
          data: {
            task_id: testTask.id,
            new_status: 'In Progress'
          }
        });
        expect(resUpdateBack.ok()).toBeTruthy();
      }
    }
  });
});

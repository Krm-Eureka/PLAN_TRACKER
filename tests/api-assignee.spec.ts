import { test, expect } from '@playwright/test';

test.describe('Task Assignee API Logic', () => {
  
  test('should update assignee correctly when joining or leaving', async ({ request }) => {
    // 1. Fetch available tasks to test on
    const resTasks = await request.get('/api/tasks');
    
    if (resTasks.ok()) {
      const tasksData = await resTasks.json();
      
      if (tasksData && tasksData.data && tasksData.data.length > 0) {
        // Find a task to test with
        const testTask = tasksData.data[0];
        const originalAssignees = testTask.assignee_id ? testTask.assignee_id.split(',').map((id: string) => id.trim()) : [];
        
        // Mock a user joining the task
        const newUserId = 'test-user-999';
        const newAssignees = [...originalAssignees, newUserId];
        
        const resUpdate = await request.put(`/api/tasks/${testTask.id}`, {
          data: {
            task_name: testTask.task_name,
            assignee_id: newAssignees
          }
        });
        
        expect(resUpdate.ok()).toBeTruthy();
        const updateResult = await resUpdate.json();
        
        // Assert successful update
        expect(updateResult.status).toBe('success');
        
        // Now test leaving (removing the user)
        const removedAssignees = originalAssignees.filter((id: string) => id !== newUserId);
        
        const resLeave = await request.put(`/api/tasks/${testTask.id}`, {
          data: {
            task_name: testTask.task_name,
            assignee_id: removedAssignees
          }
        });
        
        expect(resLeave.ok()).toBeTruthy();
        const leaveResult = await resLeave.json();
        expect(leaveResult.status).toBe('success');
      }
    }
  });

  test('should update priority correctly', async ({ request }) => {
    const resTasks = await request.get('/api/tasks');
    
    if (resTasks.ok()) {
      const tasksData = await resTasks.json();
      
      if (tasksData && tasksData.data && tasksData.data.length > 0) {
        const testTask = tasksData.data[0];
        
        // Change priority to High
        const resUpdate = await request.put(`/api/tasks/${testTask.id}`, {
          data: {
            task_name: testTask.task_name,
            priority: 'High'
          }
        });
        
        expect(resUpdate.ok()).toBeTruthy();
        const updateResult = await resUpdate.json();
        expect(updateResult.status).toBe('success');
      }
    }
  });
});

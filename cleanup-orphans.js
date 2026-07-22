require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_POSTGRES_URL_NON_POOLING,
  ssl: { rejectUnauthorized: false }
});

async function cleanup() {
  const client = await pool.connect();
  try {
    // 1. Check orphaned manager_id in Project
    const orphanedManagers = await client.query(`
      SELECT p.id, p.manager_id, p.project_name
      FROM "Project" p
      WHERE p.manager_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = p.manager_id)
    `);
    console.log('Orphaned Project.manager_id rows:', orphanedManagers.rows.length);
    orphanedManagers.rows.forEach(r => console.log(' -', r.project_name, '| manager_id:', r.manager_id));

    if (orphanedManagers.rows.length > 0) {
      await client.query(`
        UPDATE "Project"
        SET manager_id = NULL
        WHERE manager_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "Project".manager_id)
      `);
      console.log('✓ Cleared orphaned manager_id values');
    }

    // 2. Check orphaned Plan.user_id
    const orphanedPlanUsers = await client.query(`
      SELECT id, user_id FROM "Plan"
      WHERE user_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "Plan".user_id)
    `);
    console.log('Orphaned Plan.user_id rows:', orphanedPlanUsers.rows.length);
    if (orphanedPlanUsers.rows.length > 0) {
      await client.query(`
        UPDATE "Plan" SET user_id = NULL
        WHERE user_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "Plan".user_id)
      `);
      console.log('✓ Cleared orphaned Plan.user_id values');
    }

    // 3. Check orphaned Plan.project_id
    const orphanedPlanProjects = await client.query(`
      SELECT id, project_id FROM "Plan"
      WHERE project_id IS NOT NULL AND project_id != ''
        AND NOT EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "Plan".project_id)
    `);
    console.log('Orphaned Plan.project_id rows:', orphanedPlanProjects.rows.length);
    if (orphanedPlanProjects.rows.length > 0) {
      await client.query(`
        UPDATE "Plan" SET project_id = NULL
        WHERE project_id IS NOT NULL AND project_id != ''
          AND NOT EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "Plan".project_id)
      `);
      console.log('✓ Cleared orphaned Plan.project_id values');
    }

    // 4. Check orphaned Plan.task_id
    const orphanedPlanTasks = await client.query(`
      SELECT id, task_id FROM "Plan"
      WHERE task_id IS NOT NULL AND task_id != ''
        AND NOT EXISTS (SELECT 1 FROM "Task" t WHERE t.id = "Plan".task_id)
    `);
    console.log('Orphaned Plan.task_id rows:', orphanedPlanTasks.rows.length);
    if (orphanedPlanTasks.rows.length > 0) {
      await client.query(`
        UPDATE "Plan" SET task_id = NULL
        WHERE task_id IS NOT NULL AND task_id != ''
          AND NOT EXISTS (SELECT 1 FROM "Task" t WHERE t.id = "Plan".task_id)
      `);
      console.log('✓ Cleared orphaned Plan.task_id values');
    }

    // 5. Check orphaned Notification.user_id
    const orphanedNotifs = await client.query(`
      SELECT id, user_id FROM "Notification"
      WHERE user_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "Notification".user_id)
    `);
    console.log('Orphaned Notification.user_id rows:', orphanedNotifs.rows.length);
    if (orphanedNotifs.rows.length > 0) {
      await client.query(`
        DELETE FROM "Notification"
        WHERE user_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "Notification".user_id)
      `);
      console.log('✓ Deleted orphaned Notification rows');
    }

    // 6. Check Task.parent_task_id
    const orphanedParents = await client.query(`
      SELECT id, parent_task_id FROM "Task"
      WHERE parent_task_id IS NOT NULL AND parent_task_id != ''
        AND NOT EXISTS (SELECT 1 FROM "Task" t WHERE t.id = "Task".parent_task_id)
    `);
    console.log('Orphaned Task.parent_task_id rows:', orphanedParents.rows.length);
    if (orphanedParents.rows.length > 0) {
      await client.query(`
        UPDATE "Task" SET parent_task_id = NULL
        WHERE parent_task_id IS NOT NULL AND parent_task_id != ''
          AND NOT EXISTS (SELECT 1 FROM "Task" t WHERE t.id = "Task".parent_task_id)
      `);
      console.log('✓ Cleared orphaned Task.parent_task_id values');
    }

    // 7. Also null out empty strings for all nullable FK columns
    await client.query(`UPDATE "Project" SET manager_id = NULL WHERE manager_id = ''`);
    await client.query(`UPDATE "Plan" SET user_id = NULL WHERE user_id = ''`);
    await client.query(`UPDATE "Plan" SET project_id = NULL WHERE project_id = ''`);
    await client.query(`UPDATE "Plan" SET task_id = NULL WHERE task_id = ''`);
    await client.query(`UPDATE "Task" SET parent_task_id = NULL WHERE parent_task_id = ''`);
    await client.query(`UPDATE "Notification" SET user_id = NULL WHERE user_id = ''`);
    console.log('✓ Cleared all empty string FK values');

    console.log('\n✅ All orphaned data cleaned up! Ready for db push.');
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });

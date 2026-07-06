// =============================================================
// IT Tracker - Google Apps Script (Full Backend)
// Database: Google Sheets
// =============================================================

// =============================================================
// UTILITY
// =============================================================

function generateUUID() {
  return Utilities.getUuid();
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================
// SETUP DATABASE SCHEMA
// Run this once to create/fix all sheets with correct headers
// =============================================================

/**
 * สร้าง/ซ่อมแซมชีตทั้งหมดให้ตรงกับ Schema ของ Next.js
 * !! คำเตือน: จะล้าง Header แถวแรกและตั้งใหม่ แต่ไม่ลบข้อมูล
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheetsConfig = [
    {
      name: "Projects",
      // PK: id (UUID)
      // FK: manager_id -> Users.id
      headers: [
        "id",           // UUID - PK
        "project_code", // รหัสโปรเจกต์ เช่น 26LA004
        "project_name", // ชื่อโปรเจกต์
        "client_name",  // ชื่อลูกค้า
        "manager_id",   // FK -> Users.id (ผู้จัดการโปรเจกต์)
        "start_date",   // วันเริ่ม
        "end_date",     // วันสิ้นสุด
        "status",       // Planning / In Progress / Done / Hold / Cancel
        "priority",     // Low / Medium / High
        "department"    // แผนก (comma-separated เช่น IT,KRM)
      ]
    },
    {
      name: "Tasks",
      // PK: id (UUID)
      // FK: project_id -> Projects.id, assignee_id -> Users.id
      headers: [
        "id",           // UUID - PK
        "project_id",   // FK -> Projects.id
        "task_name",    // ชื่องาน
        "description",  // รายละเอียด
        "assignee_id",  // FK -> Users.id (ผู้รับผิดชอบ)
        "start_date",   // วันเริ่ม
        "due_date",     // กำหนดส่ง
        "status",       // To Do / In Progress / Review / Done / Hold / Cancel
        "priority"      // Low / Medium / High
      ]
    },
    {
      name: "Plans",
      // PK: id (UUID)
      // FK: user_id -> Users.id, project_id -> Projects.id
      headers: [
        "id",           // UUID - PK
        "user_id",      // FK -> Users.id (ผู้แจ้งแผน)
        "project_id",   // FK -> Projects.id (โปรเจกต์ที่เกี่ยวข้อง, optional)
        "start_date",   // วันที่ทำงาน
        "location",     // สถานที่ (ออฟฟิศ / หน้างาน / Work From Home)
        "duration_days" // จำนวนวัน
      ]
    },
    {
      name: "Users",
      // PK: id (UUID)
      headers: [
        "id",           // UUID - PK
        "emp_id",       // รหัสพนักงาน เช่น EMP001
        "name_th",      // ชื่อ-นามสกุล (ไทย)
        "name_en",      // ชื่อ-นามสกุล (อังกฤษ)
        "nickname",     // ชื่อเล่น
        "dl_status",    // DL / Non DL
        "position",     // ตำแหน่ง
        "department",   // แผนก (KRM / EA / etc.)
        "division",     // ฝ่าย (IT / HR / etc.)
        "start_date",   // วันเริ่มงาน
        "telephone",    // เบอร์โทร
        "email",        // อีเมล (ใช้ Login)
        "role_system",  // superAdmin / Admin / Manager / staff
        "active_tasks"  // จำนวนงานที่ค้างอยู่ (auto-update)
      ]
    },
    {
      name: "Assignments_Log",
      // PK: id (UUID)
      // FK: task_id -> Tasks.id
      headers: [
        "id",           // UUID - PK
        "task_id",      // FK -> Tasks.id
        "from_email",   // อีเมลคนที่มอบหมาย
        "to_email",     // อีเมลคนที่รับมอบหมาย
        "reason",       // เหตุผล
        "timestamp"     // เวลา
      ]
    },
    {
      name: "Notifications",
      headers: [
        "id",           // UUID - PK
        "target_email", // อีเมลผู้รับ
        "message",      // ข้อความ
        "type",         // info / warning / success / error
        "is_read",      // TRUE / FALSE
        "created_at"    // เวลา
      ]
    },
    {
      name: "Roles",
      headers: [
        "role_name",              // ชื่อ Role
        "description",            // คำอธิบาย
        "can_view_all_workload",  // TRUE/FALSE
        "can_edit_projects",      // TRUE/FALSE
        "can_assign_tasks",       // TRUE/FALSE
        "can_manage_users"        // TRUE/FALSE
      ]
    }
  ];

  sheetsConfig.forEach(config => {
    let sheet = ss.getSheetByName(config.name);
    if (!sheet) {
      sheet = ss.insertSheet(config.name);
      Logger.log("Created sheet: " + config.name);
    }
    
    // ตั้ง Header (แค่แถวแรก ไม่ลบข้อมูล)
    sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
    sheet.getRange(1, 1, 1, config.headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    Logger.log("Updated headers for: " + config.name);
  });
  
  // ลบ Sheet1 ถ้ามี
  const sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }

  // เพิ่ม Roles เริ่มต้น (ถ้ายังไม่มี)
  seedRoles();
  
  Logger.log("✅ Database setup complete!");
}

// =============================================================
// DATA SEEDING
// =============================================================

function seedRoles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rolesSheet = ss.getSheetByName("Roles");
  
  if (rolesSheet && rolesSheet.getLastRow() <= 1) {
    const rolesData = [
      ["superAdmin", "เข้าถึงทุกส่วนของระบบ", true, true, true, true],
      ["Admin",      "จัดการโปรเจกต์/งานของแผนกตัวเอง", false, true, true, false],
      ["Manager",    "สร้างโปรเจกต์ มอบหมายงานให้ทีม", false, true, true, false],
      ["staff",      "ดู/อัปเดตสถานะงานที่ได้รับมอบหมาย", false, false, false, false]
    ];
    rolesSheet.getRange(2, 1, rolesData.length, rolesData[0].length).setValues(rolesData);
    Logger.log("Roles seeded.");
  }
}

// =============================================================
// MIGRATION: แก้ไขข้อมูลเก่าให้ตรง Schema ใหม่
// 
// !! อ่านก่อนรัน !!
// 1. รัน setupDatabase() ก่อนเพื่อให้ Header ถูกต้อง
// 2. แล้วรัน migrateExistingData() เพื่อแก้ข้อมูลที่มีอยู่
// =============================================================

/**
 * แก้ไขข้อมูลเก่า:
 * - Projects: เพิ่ม UUID ที่ขาด, แก้ column descriptions -> client_name ถ้าจำเป็น
 * - Plans: เพิ่มคอลัมน์ project_id ถ้าขาด
 * - สร้าง Map email -> UUID จาก Users แล้ว map ไปยัง Tasks.assignee_id
 */
function migrateExistingData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Logger.log("=== Starting Migration ===");
  
  // 1. สร้าง email->UUID map จาก Users
  const usersSheet = ss.getSheetByName("Users");
  const usersData = usersSheet ? usersSheet.getDataRange().getValues() : [];
  const usersHeaders = usersData.length > 0 ? usersData[0] : [];
  
  const uIdIdx    = usersHeaders.indexOf("id");
  const uEmailIdx = usersHeaders.indexOf("email");
  const uEmpIdx   = usersHeaders.indexOf("emp_id");
  
  const emailToId = {};
  const empToId   = {};
  const idToEmail = {};
  
  for (let i = 1; i < usersData.length; i++) {
    const row = usersData[i];
    let uid = row[uIdIdx] ? String(row[uIdIdx]).trim() : "";
    
    // ถ้า user ไม่มี id ให้สร้างใหม่
    if (!uid) {
      uid = generateUUID();
      usersSheet.getRange(i + 1, uIdIdx + 1).setValue(uid);
      Logger.log("Generated UUID for user row " + (i+1));
    }
    
    const email = uEmailIdx >= 0 && row[uEmailIdx] ? String(row[uEmailIdx]).trim().toLowerCase() : "";
    const emp   = uEmpIdx   >= 0 && row[uEmpIdx]   ? String(row[uEmpIdx]).trim() : "";
    
    if (email) { emailToId[email] = uid; idToEmail[uid] = email; }
    if (emp)   { empToId[emp]     = uid; }
  }
  Logger.log("Users mapped: " + Object.keys(emailToId).length + " emails");
  
  // 2. Projects - เพิ่ม UUID ที่ขาด
  const projSheet   = ss.getSheetByName("Projects");
  const projData    = projSheet ? projSheet.getDataRange().getValues() : [];
  const projHeaders = projData.length > 0 ? projData[0] : [];
  
  const pIdIdx   = projHeaders.indexOf("id");
  const pCodeIdx = projHeaders.indexOf("project_code");
  
  const projectCodeToId = {};
  
  if (projSheet && pIdIdx >= 0) {
    for (let i = 1; i < projData.length; i++) {
      const row = projData[i];
      let pid = row[pIdIdx] ? String(row[pIdIdx]).trim() : "";
      
      if (!pid) {
        pid = generateUUID();
        projSheet.getRange(i + 1, pIdIdx + 1).setValue(pid);
        Logger.log("Generated UUID for project row " + (i+1));
      }
      
      const code = pCodeIdx >= 0 && row[pCodeIdx] ? String(row[pCodeIdx]).trim() : "";
      if (code) projectCodeToId[code] = pid;
    }
  }
  Logger.log("Projects mapped: " + Object.keys(projectCodeToId).length + " codes");
  
  // 3. Tasks - เพิ่ม UUID ที่ขาด, แปลง assignee email/name -> UUID ถ้าจำเป็น
  const tasksSheet   = ss.getSheetByName("Tasks");
  const tasksData    = tasksSheet ? tasksSheet.getDataRange().getValues() : [];
  const tasksHeaders = tasksData.length > 0 ? tasksData[0] : [];
  
  const tIdIdx       = tasksHeaders.indexOf("id");
  const tAssigneeIdx = tasksHeaders.indexOf("assignee_id");
  const tProjectIdx  = tasksHeaders.indexOf("project_id");
  
  if (tasksSheet && tIdIdx >= 0) {
    for (let i = 1; i < tasksData.length; i++) {
      const row = tasksData[i];
      
      // สร้าง id ถ้าขาด
      let tid = row[tIdIdx] ? String(row[tIdIdx]).trim() : "";
      if (!tid) {
        tid = generateUUID();
        tasksSheet.getRange(i + 1, tIdIdx + 1).setValue(tid);
      }
      
      // แปลง assignee_id: ถ้าเป็น email ให้หา UUID
      if (tAssigneeIdx >= 0) {
        const assigneeVal = row[tAssigneeIdx] ? String(row[tAssigneeIdx]).trim() : "";
        if (assigneeVal && assigneeVal.indexOf('@') !== -1) {
          // เป็น email อยู่ -> แปลงเป็น UUID
          const mappedId = emailToId[assigneeVal.toLowerCase()] || assigneeVal;
          tasksSheet.getRange(i + 1, tAssigneeIdx + 1).setValue(mappedId);
        }
      }
    }
  }
  Logger.log("Tasks processed.");
  
  // 4. Plans - เพิ่ม UUID ที่ขาด
  const plansSheet   = ss.getSheetByName("Plans");
  const plansData    = plansSheet ? plansSheet.getDataRange().getValues() : [];
  const plansHeaders = plansData.length > 0 ? plansData[0] : [];
  
  const planIdIdx     = plansHeaders.indexOf("id");
  const planUserIdx   = plansHeaders.indexOf("user_id");
  const planProjIdx   = plansHeaders.indexOf("project_id");
  
  if (plansSheet && planIdIdx >= 0) {
    for (let i = 1; i < plansData.length; i++) {
      const row = plansData[i];
      
      // สร้าง id ถ้าขาด
      let planId = row[planIdIdx] ? String(row[planIdIdx]).trim() : "";
      if (!planId) {
        planId = generateUUID();
        plansSheet.getRange(i + 1, planIdIdx + 1).setValue(planId);
      }
      
      // แปลง user_id: ถ้าเป็น email ให้หา UUID
      if (planUserIdx >= 0) {
        const userVal = row[planUserIdx] ? String(row[planUserIdx]).trim() : "";
        if (userVal && userVal.indexOf('@') !== -1) {
          const mappedId = emailToId[userVal.toLowerCase()] || userVal;
          plansSheet.getRange(i + 1, planUserIdx + 1).setValue(mappedId);
        }
      }
    }
  }
  Logger.log("Plans processed.");
  
  Logger.log("=== Migration Complete! ===");
  SpreadsheetApp.getUi().alert("Migration เสร็จสิ้น! ✅\n\nตรวจสอบ Logger (View > Logs) สำหรับรายละเอียด");
}

// =============================================================
// WEB APP API ENDPOINTS
// =============================================================

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // ---- GET TASKS ----
    if (action === 'getTasks') {
      return sheetToJson(ss, 'Tasks');
    }
    
    // ---- GET PROJECTS ----
    if (action === 'getProjects') {
      return sheetToJson(ss, 'Projects');
    }
    
    // ---- GET USERS ----
    if (action === 'getUsers') {
      return sheetToJson(ss, 'Users');
    }
    
    // ---- GET PLANS ----
    if (action === 'getPlans') {
      return sheetToJson(ss, 'Plans');
    }

    // ---- CHECK GROUP MEMBER ----
    if (action === 'checkGroupMember') {
      const email = e.parameter.email;
      if (!email) return jsonResponse({ status: 'error', message: 'Email parameter missing' });
      
      const groupEmail = "it@eurekaautomation.co.th";
      try {
        const result = AdminDirectory.Members.list(groupEmail);
        const members = result.members || [];
        const isMember = members.some(m => m.email.toLowerCase() === email.toLowerCase());
        return jsonResponse({ status: 'success', isMember: isMember });
      } catch (err) {
        return jsonResponse({ status: 'error', message: err.toString() });
      }
    }

    // ---- GET GROUP MEMBERS ----
    if (action === 'getGroupMembersList') {
      const groupEmail = "it@eurekaautomation.co.th";
      try {
        const result = AdminDirectory.Members.list(groupEmail);
        const members = (result.members || []).map(m => ({
          email: m.email,
          role: m.role,
          type: m.type
        }));
        return jsonResponse({ status: 'success', data: members });
      } catch (err) {
        return jsonResponse({ status: 'error', message: err.toString() });
      }
    }

    return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

function doPost(e) {
  if (typeof e === 'undefined') {
    return jsonResponse({ status: 'error', message: 'No event object' });
  }

  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const payload = params.payload;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ---- CREATE TASK ----
    if (action === 'createTask') {
      const sheet    = ss.getSheetByName('Tasks');
      const logSheet = ss.getSheetByName('Assignments_Log');
      
      const newTaskId = generateUUID();
      
      // Columns: id, project_id, task_name, description, assignee_id, start_date, due_date, status, priority
      sheet.appendRow([
        newTaskId,
        payload.project_id   || '',
        payload.task_name    || '',
        payload.description  || '',
        payload.assignee_id  || '',
        payload.start_date   || '',
        payload.due_date     || '',
        'To Do',
        payload.priority     || 'Medium'
      ]);
      
      // Log
      if (logSheet) {
        logSheet.appendRow([
          generateUUID(),
          newTaskId,
          payload.created_by  || '',
          payload.assignee_id || '',
          'Initial assignment',
          new Date()
        ]);
      }
      
      return jsonResponse({ status: 'success', message: 'Task created', task_id: newTaskId });
    }

    // ---- UPDATE TASK STATUS ----
    if (action === 'updateTaskStatus') {
      const sheet   = ss.getSheetByName('Tasks');
      const data    = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx   = headers.indexOf('id');
      const stIdx   = headers.indexOf('status');
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === String(payload.task_id)) {
          sheet.getRange(i + 1, stIdx + 1).setValue(payload.new_status);
          return jsonResponse({ status: 'success', message: 'Status updated' });
        }
      }
      return jsonResponse({ status: 'error', message: 'Task not found' });
    }

    // ---- CREATE PLAN ----
    if (action === 'createPlan') {
      const sheet = ss.getSheetByName('Plans');
      const newId = generateUUID();
      
      // Columns: id, user_id, project_id, start_date, location, duration_days
      sheet.appendRow([
        newId,
        payload.user_id       || '',
        payload.project_id    || '',
        payload.start_date    || '',
        payload.location      || '',
        payload.duration_days || 1
      ]);
      
      return jsonResponse({ status: 'success', message: 'Plan created', plan_id: newId });
    }

    return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

// =============================================================
// HELPER FUNCTIONS
// =============================================================

/**
 * อ่านข้อมูลจากชีตแล้วแปลงเป็น JSON Array
 */
function sheetToJson(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return jsonResponse({ status: 'error', message: 'Sheet not found: ' + sheetName });
  }
  
  const data    = sheet.getDataRange().getValues();
  if (data.length === 0) {
    return jsonResponse({ status: 'success', data: [] });
  }
  
  const headers = data[0];
  const rows    = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] !== undefined ? String(row[index]) : '';
    });
    return obj;
  }).filter(row => row[headers[0]] !== ''); // กรองแถวว่าง
  
  return jsonResponse({ status: 'success', data: rows });
}

/**
 * Custom function สำหรับ Google Sheets cell
 * @return {string}
 * @customfunction
 */
function UUID() {
  return generateUUID();
}

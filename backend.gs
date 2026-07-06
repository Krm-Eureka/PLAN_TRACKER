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
        "id",             // A — UUID PK
        "project_id",     // B — FK -> Projects.id
        "task_name",      // C — ชื่องาน
        "description",    // D — รายละเอียด
        "assignee_id",    // E — FK -> Users.id
        "assignee_name",  // F — ชื่ออ่านง่าย (auto-fill)
        "start_date",     // G — วันที่วางแผนเริ่มงาน
        "due_date",       // H — วันกำหนดเสร็จ (deadline)
        "end_date",       // I — วันที่ Done จริง (auto-set เมื่อ status = Done)
        "is_delay",       // J — TRUE/FALSE: end_date > due_date
        "status",         // K — To Do/In Progress/Review/Done/Hold/Cancel
        "priority"        // L — Low/Medium/High
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
        "role_system",  // superAdmin / Admin / Manager / staff ← ใช้ Login
        "role",         // ชื่อ Role ที่แสดง เช่น Super Admin / ผู้จัดการ / เจ้าหน้าที่
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
// SEED SAMPLE DATA
// รันหลังจาก setupDatabase() เพื่อใส่ข้อมูลตัวอย่างครบชุด
// !! ใช้ครั้งเดียวเท่านั้น จะตรวจสอบก่อนว่ามีข้อมูลหรือยัง
// =============================================================

function seedSampleData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // ---- USERS ----
  const usersSheet = ss.getSheetByName("Users");
  if (usersSheet && usersSheet.getLastRow() <= 1) {
    // id, emp_id, name_th, name_en, nickname, dl_status, position, department, division, start_date, telephone, email, role_system, role, active_tasks
    const users = [
      [generateUUID(), "EMP001", "วิศรุต สนองผัน",    "Witsarut Sanongphun",  "วิท",  "Non DL", "IT Programmer",     "KRM", "IT", "2024-01-01", "0962231700", "witsarut@eurekaautomation.co.th",  "superAdmin", "Super Admin",  0],
      [generateUUID(), "EMP002", "สมชาย ใจดี",        "Somchai Jaidee",       "ชาย",  "DL",     "Project Manager",   "KRM", "IT", "2023-06-01", "081-000-0001", "somchai@eurekaautomation.co.th",  "Manager",    "ผู้จัดการโปรเจกต์", 0],
      [generateUUID(), "EMP003", "สมหญิง รักงาน",     "Somying Rakngarn",     "หญิง", "Non DL", "IT Support",        "KRM", "IT", "2023-09-01", "081-000-0002", "somying@eurekaautomation.co.th",  "staff",      "เจ้าหน้าที่",       0],
      [generateUUID(), "EMP004", "ธนากร พัฒนา",       "Thanakorn Pattana",    "ตอง", "Non DL",  "System Analyst",    "KRM", "IT", "2022-03-15", "081-000-0003", "thanakorn@eurekaautomation.co.th","Admin",      "ผู้ดูแลระบบ",        0],
      [generateUUID(), "EMP005", "มานี มีนา",          "Manee Meena",          "มา",  "DL",     "Automation Engineer","EA",  "ENG","2021-11-01", "081-000-0004", "manee@eurekaautomation.co.th",    "staff",      "เจ้าหน้าที่",       0]
    ];
    usersSheet.getRange(2, 1, users.length, users[0].length).setValues(users);
    Logger.log("✅ Users seeded: " + users.length + " rows");
  } else {
    Logger.log("⏭️  Users already has data, skipping.");
  }
  
  // โหลด user map email->id สำหรับใช้ seed Tasks
  const usersData = usersSheet.getDataRange().getValues();
  const uHeaders = usersData[0];
  const uIdIdx    = uHeaders.indexOf("id");
  const uEmailIdx = uHeaders.indexOf("email");
  const uNameIdx  = uHeaders.indexOf("name_th");
  const emailToId = {};
  const emailToName = {};
  for (let i = 1; i < usersData.length; i++) {
    const email = String(usersData[i][uEmailIdx] || "").toLowerCase();
    if (email) {
      emailToId[email]   = String(usersData[i][uIdIdx]);
      emailToName[email] = String(usersData[i][uNameIdx]);
    }
  }
  
  // ---- PROJECTS ----
  const projSheet = ss.getSheetByName("Projects");
  const proj26LA004Id = generateUUID();
  const proj25M025Id  = generateUUID();
  const proj25LA001Id = generateUUID();
  
  const managerEmail = "somchai@eurekaautomation.co.th";
  const managerId    = emailToId[managerEmail] || "";
  
  if (projSheet && projSheet.getLastRow() <= 1) {
    // id, project_code, project_name, client_name, manager_id, start_date, end_date, status, priority, department
    const projects = [
      [proj26LA004Id, "26LA004", "ASRS for Gravure Printing Cylinders", "CPPC",   managerId, "2026-07-04", "2027-07-04", "In Progress", "High",   "IT,KRM"],
      [proj25M025Id,  "25M025",  "MEKTEC - AUTOPACKING",                "MEKTEC", managerId, "2025-04-01", "2026-07-15", "In Progress", "Medium", "IT,KRM"],
      [proj25LA001Id, "25LA001", "AMR MOVING",                          "MEKTEC", managerId, "2025-04-02", "2026-07-16", "Done",        "Medium", "IT,KRM"]
    ];
    projSheet.getRange(2, 1, projects.length, projects[0].length).setValues(projects);
    Logger.log("✅ Projects seeded: " + projects.length + " rows");
  } else {
    Logger.log("⏭️  Projects already has data, skipping.");
  }
  
  // ---- TASKS ----
  const tasksSheet = ss.getSheetByName("Tasks");
  if (tasksSheet && tasksSheet.getLastRow() <= 1) {
    const witsarutEmail  = "witsarut@eurekaautomation.co.th";
    const somchaiEmail   = "somchai@eurekaautomation.co.th";
    const somyingEmail   = "somying@eurekaautomation.co.th";
    
    const wId = emailToId[witsarutEmail]  || "";
    const sId = emailToId[somchaiEmail]   || "";
    const yId = emailToId[somyingEmail]   || "";
    const wName = emailToName[witsarutEmail]  || "วิศรุต";
    const sName = emailToName[somchaiEmail]   || "สมชาย";
    const yName = emailToName[somyingEmail]   || "สมหญิง";
    
    // id, project_id, task_name, description, assignee_id, assignee_name, start_date, due_date, end_date, is_delay, status, priority
    const tasks = [
      //                                                                                                   end_date  is_delay  status         priority
      [generateUUID(), proj26LA004Id, "BLUEPRINT_MEETING",    "ประชุม Blueprint กับ Operator", wId, wName, "2026-07-03", "2026-07-07", "",           "",      "Review",      "High"],
      [generateUUID(), proj26LA004Id, "Map Scan - ชั้น 1",    "Map Scanning: Time 10:00-16:30",       wId, wName, "2025-12-01", "2025-12-01", "2025-12-01", "FALSE", "Done",        "Normal"],
      [generateUUID(), proj26LA004Id, "Map Scan - ชั้น 2,3",  "Map Scanning ชั้น 2 และ 3",            sId, sName, "2025-12-02", "2025-12-02", "2025-12-02", "FALSE", "Done",        "Normal"],
      [generateUUID(), proj26LA004Id, "Create Work Flow",     "สร้าง Workflow สำหรับระบบ",            yId, yName, "2025-12-08", "2025-12-08", "2025-12-08", "FALSE", "Done",        "Normal"],
      [generateUUID(), proj25M025Id,  "Config Robot",         "ตั้งค่า Robot ใหม่ตามแผน AUTOPACKING", wId, wName, "2026-05-01", "2026-05-15", "",           "",      "In Progress", "High"],
      [generateUUID(), proj25M025Id,  "Test Robot Movement",  "ทดสอบการเคลื่อนที่ของ Robot",         sId, sName, "2026-05-16", "2026-05-20", "",           "",      "To Do",       "High"],
      [generateUUID(), proj25LA001Id, "AMR Route Setup",      "ตั้งค่าเส้นทาง AMR ทั้งหมด",           yId, yName, "2025-04-02", "2025-04-10", "2025-04-10", "FALSE", "Done",        "Medium"],
      // ตัวอย่าง Delay: Done เกิน due_date
      [generateUUID(), proj25LA001Id, "Site Acceptance Test", "ทดสอบกับลูกค้าที่หน้างาน",             wId, wName, "2025-06-01", "2025-07-16", "2025-07-20", "TRUE",  "Done",        "Medium"]
    ];
    tasksSheet.getRange(2, 1, tasks.length, tasks[0].length).setValues(tasks);
    Logger.log("✅ Tasks seeded: " + tasks.length + " rows");
  } else {
    Logger.log("⏭️  Tasks already has data, skipping.");
  }
  
  SpreadsheetApp.getUi().alert(
    "✅ Seed ข้อมูลตัวอย่างเสร็จสิ้น!\n\n" +
    "Users: 5 คน (superAdmin, Manager, Admin, staff)\n" +
    "Projects: 3 โปรเจกต์\n" +
    "Tasks: 8 งาน\n\n" +
    "💡 คอลัมน์ assignee_name ในชีต Tasks จะแสดงชื่อผู้รับงานให้อ่านง่ายครับ"
  );
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
      
      // Columns: A=id, B=project_id, C=task_name, D=description, E=assignee_id, F=assignee_name,
      //          G=start_date, H=due_date, I=end_date, J=is_delay, K=status, L=priority
      sheet.appendRow([
        newTaskId,
        payload.project_id    || '',
        payload.task_name     || '',
        payload.description   || '',
        payload.assignee_id   || '',
        payload.assignee_name || '',
        payload.start_date    || '',
        payload.due_date      || '',
        '',           // end_date — set when Done
        '',           // is_delay — computed when Done
        'To Do',
        payload.priority || 'Medium'
      ]);
      
      // Log assignment
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
      const idIdx      = headers.indexOf('id');       // col A
      const dueDateIdx = headers.indexOf('due_date'); // col H
      const endDateIdx = headers.indexOf('end_date'); // col I
      const isDelayIdx = headers.indexOf('is_delay'); // col J
      const stIdx      = headers.indexOf('status');   // col K
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === String(payload.task_id)) {
          const rowNum = i + 1;
          
          // Update status
          sheet.getRange(rowNum, stIdx + 1).setValue(payload.new_status);
          
          const isDone = ['done','complete','completed'].includes(
            String(payload.new_status).toLowerCase()
          );
          
          if (isDone && endDateIdx >= 0) {
            const today   = new Date();
            const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            sheet.getRange(rowNum, endDateIdx + 1).setValue(todayStr);
            
            // Compute is_delay
            if (isDelayIdx >= 0 && dueDateIdx >= 0) {
              const dueStr = String(data[i][dueDateIdx] || '');
              const isDelay = dueStr && new Date(todayStr) > new Date(dueStr);
              sheet.getRange(rowNum, isDelayIdx + 1).setValue(isDelay ? 'TRUE' : 'FALSE');
            }
          } else if (!isDone && endDateIdx >= 0) {
            // Revert: clear end_date and is_delay
            sheet.getRange(rowNum, endDateIdx + 1).setValue('');
            if (isDelayIdx >= 0) sheet.getRange(rowNum, isDelayIdx + 1).setValue('');
          }
          
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

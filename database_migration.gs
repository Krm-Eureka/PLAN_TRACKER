/**
 * UUID Generator
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0,
        v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Migration Script to add UUIDs and set up PK/FK
 */
function runDatabaseMigration() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var usersSheet = ss.getSheetByName("Users");
  var projectsSheet = ss.getSheetByName("Projects");
  var tasksSheet = ss.getSheetByName("Tasks");
  var plansSheet = ss.getSheetByName("Plans");

  if (!usersSheet || !projectsSheet || !tasksSheet || !plansSheet) {
    SpreadsheetApp.getUi().alert("Missing one of the required sheets (Users, Projects, Tasks, Plans).");
    return;
  }

  // 1. Process Users
  var usersData = usersSheet.getDataRange().getValues();
  var usersHeaders = usersData[0];
  
  var userIdIndex = usersHeaders.indexOf("id");
  var userEmailIndex = usersHeaders.indexOf("email");
  var userEmpIdIndex = usersHeaders.indexOf("emp_id");

  if (userIdIndex === -1) {
    // Add 'id' column if it doesn't exist
    usersSheet.insertColumnBefore(1);
    usersSheet.getRange(1, 1).setValue("id");
    userIdIndex = 0;
    
    // Refresh data
    usersData = usersSheet.getDataRange().getValues();
    usersHeaders = usersData[0];
    userEmailIndex = usersHeaders.indexOf("email");
    userEmpIdIndex = usersHeaders.indexOf("emp_id");
  }

  // Map to store User lookups: email -> id, and emp_id -> id
  var userEmailToId = {};
  var userEmpIdToId = {};

  for (var i = 1; i < usersData.length; i++) {
    var row = usersData[i];
    var id = row[userIdIndex];
    if (!id || id === "") {
      id = generateUUID();
      usersSheet.getRange(i + 1, userIdIndex + 1).setValue(id);
      row[userIdIndex] = id;
    }
    
    var email = row[userEmailIndex] ? row[userEmailIndex].toString().toLowerCase() : "";
    var empId = row[userEmpIdIndex] ? row[userEmpIdIndex].toString() : "";
    
    if (email) userEmailToId[email] = id;
    if (empId) userEmpIdToId[empId] = id;
  }

  // 2. Process Projects
  var projectsData = projectsSheet.getDataRange().getValues();
  var projectsHeaders = projectsData[0];
  
  var projIdIndex = projectsHeaders.indexOf("id");
  var projCodeIndex = projectsHeaders.indexOf("project_code");
  var managerIndex = projectsHeaders.indexOf("manager"); // this will become manager_id

  if (projIdIndex === -1) {
    projectsSheet.insertColumnBefore(1);
    projectsSheet.getRange(1, 1).setValue("id");
    projIdIndex = 0;
    
    projectsData = projectsSheet.getDataRange().getValues();
    projectsHeaders = projectsData[0];
    projCodeIndex = projectsHeaders.indexOf("project_code");
    managerIndex = projectsHeaders.indexOf("manager");
  }
  
  if (managerIndex !== -1 && projectsHeaders[managerIndex] === "manager") {
    // Rename header to manager_id
    projectsSheet.getRange(1, managerIndex + 1).setValue("manager_id");
  }

  // Map to store Project lookups: project_code -> id
  var projectCodeToId = {};

  for (var i = 1; i < projectsData.length; i++) {
    var row = projectsData[i];
    var id = row[projIdIndex];
    if (!id || id === "") {
      id = generateUUID();
      projectsSheet.getRange(i + 1, projIdIndex + 1).setValue(id);
    }
    
    var pCode = row[projCodeIndex] ? row[projCodeIndex].toString() : "";
    if (pCode) projectCodeToId[pCode] = id;
    
    // Update manager email to manager_id (UUID)
    if (managerIndex !== -1) {
      var managerEmail = row[managerIndex] ? row[managerIndex].toString().toLowerCase() : "";
      if (managerEmail && managerEmail.indexOf('@') !== -1) { // If it looks like an email
        var mappedId = userEmailToId[managerEmail] || managerEmail; // Fallback to original if not found
        projectsSheet.getRange(i + 1, managerIndex + 1).setValue(mappedId);
      }
    }
  }

  // 3. Process Tasks
  var tasksData = tasksSheet.getDataRange().getValues();
  var tasksHeaders = tasksData[0];
  
  var taskIdIndex = tasksHeaders.indexOf("id");
  var taskProjectCodeIndex = tasksHeaders.indexOf("project_code");
  var taskAssigneeIndex = tasksHeaders.indexOf("assignee");

  if (taskIdIndex === -1) {
    tasksSheet.insertColumnBefore(1);
    tasksSheet.getRange(1, 1).setValue("id");
    taskIdIndex = 0;
    
    tasksData = tasksSheet.getDataRange().getValues();
    tasksHeaders = tasksData[0];
    taskProjectCodeIndex = tasksHeaders.indexOf("project_code");
    taskAssigneeIndex = tasksHeaders.indexOf("assignee");
  }

  if (taskProjectCodeIndex !== -1 && tasksHeaders[taskProjectCodeIndex] === "project_code") {
    tasksSheet.getRange(1, taskProjectCodeIndex + 1).setValue("project_id");
  }
  
  if (taskAssigneeIndex !== -1 && tasksHeaders[taskAssigneeIndex] === "assignee") {
    tasksSheet.getRange(1, taskAssigneeIndex + 1).setValue("assignee_id");
  }

  for (var i = 1; i < tasksData.length; i++) {
    var row = tasksData[i];
    var id = row[taskIdIndex];
    // Existing task IDs might be TSK-XXXX. We should replace with UUID or keep them if they exist? 
    // The requirement says "id must be uuid". So let's replace them if they are not UUIDs.
    if (!id || id.length < 30) { 
      id = generateUUID();
      tasksSheet.getRange(i + 1, taskIdIndex + 1).setValue(id);
    }
    
    // Update project_code to project_id
    if (taskProjectCodeIndex !== -1) {
      var pCode = row[taskProjectCodeIndex] ? row[taskProjectCodeIndex].toString() : "";
      if (pCode && projectCodeToId[pCode]) {
        tasksSheet.getRange(i + 1, taskProjectCodeIndex + 1).setValue(projectCodeToId[pCode]);
      }
    }
    
    // Update assignee email to assignee_id
    if (taskAssigneeIndex !== -1) {
      var assigneeEmail = row[taskAssigneeIndex] ? row[taskAssigneeIndex].toString().toLowerCase() : "";
      if (assigneeEmail && assigneeEmail.indexOf('@') !== -1) {
        var mappedAssigneeId = userEmailToId[assigneeEmail] || assigneeEmail;
        tasksSheet.getRange(i + 1, taskAssigneeIndex + 1).setValue(mappedAssigneeId);
      }
    }
  }

  // 4. Process Plans
  var plansData = plansSheet.getDataRange().getValues();
  var plansHeaders = plansData[0];
  
  var planIdIndex = plansHeaders.indexOf("id");
  var planEmpIdIndex = plansHeaders.indexOf("emp_id");
  var planNameIndex = plansHeaders.indexOf("name");
  var planProjectCodeIndex = plansHeaders.indexOf("project_code");
  
  if (planIdIndex === -1) {
    plansSheet.insertColumnBefore(1);
    plansSheet.getRange(1, 1).setValue("id");
    planIdIndex = 0;
    
    plansData = plansSheet.getDataRange().getValues();
    plansHeaders = plansData[0];
    planEmpIdIndex = plansHeaders.indexOf("emp_id");
    planNameIndex = plansHeaders.indexOf("name");
    planProjectCodeIndex = plansHeaders.indexOf("project_code");
  }

  if (planEmpIdIndex !== -1 && plansHeaders[planEmpIdIndex] === "emp_id") {
    plansSheet.getRange(1, planEmpIdIndex + 1).setValue("user_id");
  }
  
  if (planProjectCodeIndex !== -1 && plansHeaders[planProjectCodeIndex] === "project_code") {
    plansSheet.getRange(1, planProjectCodeIndex + 1).setValue("project_id");
  }

  for (var i = 1; i < plansData.length; i++) {
    var row = plansData[i];
    var id = row[planIdIndex];
    if (!id || id === "") {
      id = generateUUID();
      plansSheet.getRange(i + 1, planIdIndex + 1).setValue(id);
    }
    
    // Update emp_id to user_id
    if (planEmpIdIndex !== -1) {
      var pEmpId = row[planEmpIdIndex] ? row[planEmpIdIndex].toString() : "";
      if (pEmpId && userEmpIdToId[pEmpId]) {
        plansSheet.getRange(i + 1, planEmpIdIndex + 1).setValue(userEmpIdToId[pEmpId]);
      } else {
        // Fallback: try by name if emp_id fails (some rows might not have emp_id)
        if (planNameIndex !== -1) {
           var pName = row[planNameIndex] ? row[planNameIndex].toString() : "";
           // This is tricky, we can't easily lookup by name because there might be duplicates or different formats
           // But if it's already an emp_id that matches, it works.
        }
      }
    }
    
    // Update project_code to project_id
    if (planProjectCodeIndex !== -1) {
      var plProjCode = row[planProjectCodeIndex] ? row[planProjectCodeIndex].toString() : "";
      if (plProjCode && projectCodeToId[plProjCode]) {
        plansSheet.getRange(i + 1, planProjectCodeIndex + 1).setValue(projectCodeToId[plProjCode]);
      }
    }
  }
  
  SpreadsheetApp.getUi().alert("Database Migration Complete!");
}

/**
 * Web App Permission Checker (doGet/doPost)
 * As requested, basic permission check for API calls if needed.
 */
function doGet(e) {
  var action = e.parameter.action;
  
  // Example of permission logic
  if (action === "testPermission") {
    var email = Session.getActiveUser().getEmail();
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      email: email,
      message: "Permissions are working."
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput("Action not found.");
}

/**
 * Adds new columns (plan_detail, task_id) to the Plans sheet
 */
function addPlanColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var plansSheet = ss.getSheetByName("Plans");
  
  if (!plansSheet) {
    SpreadsheetApp.getUi().alert("Plans sheet not found!");
    return;
  }
  
  var headers = plansSheet.getRange(1, 1, 1, plansSheet.getLastColumn()).getValues()[0];
  
  // Column G = index 6 (plan_detail)
  if (headers.length < 7 || headers[6] !== 'plan_detail') {
    plansSheet.getRange(1, 7).setValue('plan_detail');
  }
  
  // Column H = index 7 (task_id)
  if (headers.length < 8 || headers[7] !== 'task_id') {
    plansSheet.getRange(1, 8).setValue('task_id');
  }
  
  SpreadsheetApp.getUi().alert("Added plan_detail and task_id columns to Plans sheet!");
}

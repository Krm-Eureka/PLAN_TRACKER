import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, batchUpdateSheetValues, getSheetHeaders, getColumnLetter } from "@/lib/googleSheets";
import { v7 as uuidv7 } from "uuid";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = (session as { accessToken?: string })?.accessToken;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized - Please sign in first" }, { status: 401 });
  }

  try {
    const updates: { range: string, values: any[][] }[] = [];

    // 1. Setup Roles sheet (Overwrite A1:F5)
    const rolesData = [
      ["role_name", "description", "view_scope", "project_edit_scope", "task_edit_scope", "user_manage_scope"],
      ["superAdmin", "เข้าถึงทุกส่วนข้ามแผนก", "GLOBAL", "GLOBAL", "GLOBAL", "GLOBAL"],
      ["Admin", "ดูแลโปรเจกต์แผนกตัวเอง", "DEPT", "DEPT", "DEPT", "DEPT"],
      ["Manager", "สร้าง/จ่ายงานในแผนก", "DEPT", "DEPT", "DEPT", "NONE"],
      ["staff", "อัปเดตแค่งานตัวเอง", "DEPT", "NONE", "OWNED", "NONE"]
    ];
    updates.push({
      range: "Roles!A1:F5",
      values: rolesData
    });

    // 2. Setup Departments sheet with UUIDv7
    const departmentsList = [
      "MD", "ASSEMBLY", "SERVICE", "CONCEPT DESIGN", "SALE", "WIRING", 
      "MECHANICAL DESIGN", "PART FEEDER", "PURCHASING", "ELECTRICAL AND CONTROL DESIGN", 
      "STORE,COMPONENT", "ACCOUNTING AND FINANCE", "IT", "HR&ADMIN", "QA", 
      "PROJECT CONTROL", "COMPONENT PRODUCTION", "SAFETY", "QC"
    ];
    
    // Fetch existing departments to preserve IDs
    let existingDepts: any[] = [];
    try {
      existingDepts = await fetchSheetData(token, "Departments!A:Z");
    } catch {
      // Ignore if doesn't exist
    }

    const nameToId = new Map<string, string>();
    const idToName = new Map<string, string>();

    // Map existing
    existingDepts.forEach(d => {
      const name = String(d.department_name || "").toUpperCase();
      const id = String(d.id || "");
      if (name && id) {
        nameToId.set(name, id);
        idToName.set(id, name);
      }
    });

    // Create missing with UUIDv7
    const deptsWithIds = departmentsList.map(name => {
      const upperName = name.toUpperCase();
      if (!nameToId.has(upperName)) {
        const newId = uuidv7();
        nameToId.set(upperName, newId);
        idToName.set(newId, upperName);
      }
      return { id: nameToId.get(upperName)!, name };
    });

    const deptUpdates = [
      {
        range: `Departments!A1:B${deptsWithIds.length + 1}`,
        values: [
          ["id", "department_name"],
          ...deptsWithIds.map(d => [d.id, d.name])
        ]
      }
    ];

    try {
      await batchUpdateSheetValues(token, deptUpdates);
    } catch (e: any) {
      console.warn("Could not update Departments sheet, maybe it doesn't exist yet:", e.message);
    }

    // 3. Setup Users sheet (Migrate department_id and assign roles)
    const userHeaders = await getSheetHeaders(token, "Users");
    
    // Support both old "department" header and new "department_id" header for the migration
    let deptColIdx = userHeaders.findIndex(h => h === "department_id");
    if (deptColIdx === -1) deptColIdx = userHeaders.findIndex(h => h === "department");
    const deptColLetter = deptColIdx >= 0 ? getColumnLetter(deptColIdx) : "H"; // Fallback to H based on screenshot
    
    const roleSystemColIdx = userHeaders.findIndex(h => h === "role_system");
    const roleSystemColLetter = roleSystemColIdx >= 0 ? getColumnLetter(roleSystemColIdx) : "M"; 

    const users = await fetchSheetData(token, "Users!A:Z");
    
    users.forEach(u => {
      const rowIndex = u._rowIndex;
      let newRole = "";
      
      // Get raw dept string from sheet (could be name or UUID)
      const rawDept = String(u.department_id || u.department || "").trim();
      const upperDept = rawDept.toUpperCase();
      
      // Determine real department name
      let realDeptName = "";
      let newDeptId = rawDept;

      if (idToName.has(rawDept) || idToName.has(rawDept.toLowerCase())) {
        // It's already a UUID (check both exact and lowercase match)
        const matchId = idToName.has(rawDept) ? rawDept : rawDept.toLowerCase();
        realDeptName = idToName.get(matchId)!;
      } else if (nameToId.has(upperDept)) {
        // It's a string name, need to migrate to UUID
        realDeptName = upperDept;
        newDeptId = nameToId.get(upperDept)!;
      }

      // Preserve existing role_system if it exists
      newRole = String(u.role_system || "").trim();
      const displayRole = String(u.role || "").toUpperCase();

      // If user explicitly set the new 'role' column, sync it to 'role_system'
      if (displayRole === "SUPER ADMIN") {
        newRole = "superAdmin";
      } else if (displayRole === "ADMIN") {
        newRole = "Admin";
      } else if (displayRole === "MANAGER") {
        newRole = "Manager";
      } else if (displayRole === "STAFF") {
        newRole = "staff";
      } else if (!newRole) {
        // Auto-assign roles based on real department name only if empty
        if (realDeptName === "MD") {
          newRole = "superAdmin";
        } else if (realDeptName === "IT") {
          newRole = "Admin"; 
        } else {
          newRole = "staff"; // Default to staff for everyone else
        }
      }
      
      // Update role only if it changed or needs to be set
      if (newRole !== String(u.role_system || "").trim()) {
        updates.push({
          range: `Users!${roleSystemColLetter}${rowIndex}`,
          values: [[newRole]]
        });
      }

      // Migrate department name to UUID if needed
      if (newDeptId !== rawDept) {
        updates.push({
          range: `Users!${deptColLetter}${rowIndex}`,
          values: [[newDeptId]]
        });
      }
    });

    // Execute the batch update for users
    await batchUpdateSheetValues(token, updates);

    return NextResponse.json({ 
      success: true, 
      message: "อัปเดตข้อมูลชีต Roles, Users และ Departments สำเร็จเรียบร้อยแล้ว!", 
      updated_roles: rolesData.length - 1,
      updated_users: users.length,
      updated_departments: departmentsList.length
    });

  } catch (error: any) {
    console.error("Setup Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

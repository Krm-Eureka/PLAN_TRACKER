import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { appendSheetRow, appendSheetRows } from "@/lib/googleSheets";
import axios from 'axios';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;

    if (!token) {
      return NextResponse.json({ status: 'error', message: 'Not authenticated or no access token' }, { status: 401 });
    }

    const projectId = crypto.randomUUID();
    const projectCode = "TEST-HIERARCHY";
    const projectName = "Test Hierarchical Project";
    
    // Seed Project
    const projectRow = [
      projectId, projectCode, projectName, "Internal",
      "", "01/12/2025", "31/12/2025", "Planning", "High", "IT"
    ];
    await appendSheetRow(token, 'Projects!A:J', projectRow);

    const generateId = () => crypto.randomUUID();

    // Generate 15 main tasks and some subtasks
    const tasksToInsert = [];
    let currentStartDate = new Date(2025, 11, 1); // Dec 1, 2025

    for (let i = 1; i <= 15; i++) {
      const parentId = generateId();
      
      const pStart = new Date(currentStartDate);
      const pEnd = new Date(currentStartDate);
      pEnd.setDate(pEnd.getDate() + 3);

      // Main Task
      tasksToInsert.push({
        id: parentId,
        project_id: projectId,
        task_name: `Task ${i}`,
        description: `Main task ${i}`,
        assignee_id: "",
        assignee_name: "Test User",
        start_date: pStart.toISOString().split('T')[0],
        due_date: pEnd.toISOString().split('T')[0],
        end_date: "",
        is_delay: "FALSE",
        status: i < 5 ? "Done" : "In Progress",
        priority: "Normal",
        percent_complete: i < 5 ? "100" : "0", // Will be overridden by utility but we set initial
        parent_task_id: "",
        task_order: `${i}`
      });

      // Subtasks 1, 2, 3
      for (let j = 1; j <= 3; j++) {
        const subStart = new Date(pStart);
        subStart.setDate(subStart.getDate() + (j - 1));
        const subEnd = new Date(subStart);
        subEnd.setDate(subEnd.getDate() + 1);

        const subStatus = i < 5 ? "Done" : (j === 1 ? "Done" : (j === 2 ? "In Progress" : "To Do"));
        const subPct = subStatus === "Done" ? "100" : (subStatus === "In Progress" ? "50" : "0");

        tasksToInsert.push({
          id: generateId(),
          project_id: projectId,
          task_name: `Task ${i}.${j}`,
          description: `Subtask ${j} of ${i}`,
          assignee_id: "",
          assignee_name: "Test User",
          start_date: subStart.toISOString().split('T')[0],
          due_date: subEnd.toISOString().split('T')[0],
          end_date: subStatus === "Done" ? subEnd.toISOString().split('T')[0] : "",
          is_delay: "FALSE",
          status: subStatus,
          priority: "Normal",
          percent_complete: subPct,
          parent_task_id: parentId,
          task_order: `${i}.${j}`
        });
      }

      currentStartDate.setDate(currentStartDate.getDate() + 4);
    }

    const { data: headerData } = await axios.get(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID}/values/Tasks!1:1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const headers = headerData.values[0] as string[];

    const rowsToAppend = tasksToInsert.map(t => {
      const row = new Array(headers.length).fill("");
      const setVal = (key: string, val: string) => {
        const idx = headers.indexOf(key);
        if (idx !== -1) row[idx] = val;
      };

      setVal("id", t.id);
      setVal("project_id", t.project_id);
      setVal("task_name", t.task_name);
      setVal("description", t.description);
      setVal("assignee_id", t.assignee_id);
      setVal("assignee_name", t.assignee_name);
      setVal("start_date", t.start_date);
      setVal("due_date", t.due_date);
      setVal("end_date", t.end_date);
      setVal("is_delay", t.is_delay);
      setVal("status", t.status);
      setVal("priority", t.priority);
      setVal("task_order", t.task_order);
      setVal("percent_complete", t.percent_complete);
      setVal("parent_task_id", t.parent_task_id);

      return row;
    });

    // Update range to cover dynamically based on headers
    const lastColLetter = String.fromCharCode(65 + headers.length - 1);
    await appendSheetRows(token, `Tasks!A1:${lastColLetter}`, rowsToAppend);

    return NextResponse.json({ status: 'success', message: 'Seeded test hierarchy successfully' });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Seed error:", err);
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}

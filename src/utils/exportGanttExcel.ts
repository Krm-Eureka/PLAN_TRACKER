import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ProjectData, TaskData } from '@/interfaces';
import { getEffectiveStartDate, getEffectiveEndDate } from '@/utils/date';

export const exportGanttToExcel = async (project: ProjectData, tasks: TaskData[]) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Gantt Chart', { views: [{ showGridLines: false }] });

  // Sort tasks by task_order
  const sortedTasks = [...tasks].sort((a, b) => {
    const aParts = (a.task_order || '').split('.').map(Number);
    const bParts = (b.task_order || '').split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });

  // Calculate project timeline
  let minDate = new Date();
  let maxDate = new Date();
  let hasValidDates = false;

  sortedTasks.forEach(t => {
    const start = getEffectiveStartDate(t);
    const end = getEffectiveEndDate(t);
    if (start && (!hasValidDates || start < minDate)) minDate = start;
    if (end && (!hasValidDates || end > maxDate)) maxDate = end;
    if (start || end) hasValidDates = true;
  });

  if (!hasValidDates) {
    minDate = new Date();
    maxDate = new Date(minDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  // Normalize dates to start of day
  minDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
  maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());

  // Generate list of days (Include weekends as requested)
  const daysList: Date[] = [];
  let curr = new Date(minDate);
  while (curr <= maxDate) {
    daysList.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  // 1. Setup static columns
  const columns = [
    { key: 'wbs', width: 8 },
    { key: 'title', width: 35 },
    { key: 'owner', width: 20 },
    { key: 'start', width: 12 },
    { key: 'due', width: 12 },
    { key: 'duration', width: 10 },
    { key: 'pct', width: 12 },
  ];

  daysList.forEach((d, i) => {
    columns.push({ key: `day_${i}`, width: 3 });
  });
  sheet.columns = columns;

  // 2. Insert Header Information
  sheet.getCell('B2').value = 'GANTT CHART TEMPLATE';
  sheet.getCell('B2').font = { size: 24, bold: true, color: { argb: 'FF00549A' } };
  
  sheet.getCell('B4').value = 'PROJECT TITLE';
  sheet.getCell('B4').font = { bold: true, size: 9 };
  sheet.getCell('C4').value = project.project_name || '';
  sheet.getCell('C4').border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
  sheet.mergeCells('C4:E4');

  sheet.getCell('B5').value = 'PROJECT MANAGER';
  sheet.getCell('B5').font = { bold: true, size: 9 };
  // We can't easily resolve the manager's name without fetching users, so we'll leave it as ID or project info if available
  sheet.getCell('C5').value = ''; 
  sheet.getCell('C5').border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
  sheet.mergeCells('C5:E5');

  // 3. Render Timeline Headers
  const row7 = sheet.getRow(7); // Months
  const row8 = sheet.getRow(8); // Weeks
  const row9 = sheet.getRow(9); // Days

  // Set table headers
  const tableHeaders = ['WBS NUMBER', 'TASK TITLE', 'TASK OWNER', 'START DATE', 'DUE DATE', 'DURATION', 'PCT OF TASK COMPLETE'];
  tableHeaders.forEach((header, index) => {
    // Merge Row 7, 8, 9 for table headers
    sheet.mergeCells(7, index + 1, 9, index + 1);
    const cell = row7.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 8 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thick', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0'} } };
  });
  row7.height = 20;
  row8.height = 20;
  row9.height = 20;

  // Set days, weeks, and months
  const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let currentWeekNum = 1;
  let weekStartCol = 8;
  let currentMonth = daysList[0]?.getMonth();
  let currentYear = daysList[0]?.getFullYear();
  let monthStartCol = 8;
  const phaseColors = ['FF1F4E79', 'FF548235', 'FFBF8F00', 'FFC00000', 'FF7030A0'];

  daysList.forEach((d, i) => {
    const colIndex = i + 8;
    
    // Day Letter
    const cellDay = row9.getCell(colIndex);
    cellDay.value = dayLetters[d.getDay()];
    cellDay.font = { bold: true, size: 8 };
    cellDay.alignment = { horizontal: 'center', vertical: 'middle' };
    cellDay.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cellDay.border = { 
      left: { style: 'thin', color: { argb: 'FFDDDDDD'} }, 
      right: { style: 'thin', color: { argb: 'FFDDDDDD'} }, 
      bottom: { style: 'thick', color: { argb: 'FF000000'} },
      top: { style: 'thin', color: { argb: 'FFDDDDDD'} }
    };

    // Week Grouping
    if (d.getDay() === 1 || i === daysList.length - 1) {
      if (i > 0 && d.getDay() === 1) {
        if (colIndex - 1 >= weekStartCol) {
          sheet.mergeCells(8, weekStartCol, 8, colIndex - 1);
          const cellWeek = sheet.getCell(8, weekStartCol);
          cellWeek.value = `WEEK ${currentWeekNum}`;
          cellWeek.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
          cellWeek.alignment = { horizontal: 'center', vertical: 'middle' };
          
          const phaseColor = phaseColors[Math.floor((currentWeekNum - 1) / 3) % phaseColors.length];
          cellWeek.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: phaseColor } };
          cellWeek.border = { left: { style: 'thin', color: { argb: 'FFFFFFFF'} }, right: { style: 'thin', color: { argb: 'FFFFFFFF'} } };
          
          currentWeekNum++;
          weekStartCol = colIndex;
        }
      }
    }
    if (i === daysList.length - 1) {
       sheet.mergeCells(8, weekStartCol, 8, colIndex);
       const cellWeek = sheet.getCell(8, weekStartCol);
       cellWeek.value = `WEEK ${currentWeekNum}`;
       cellWeek.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
       cellWeek.alignment = { horizontal: 'center', vertical: 'middle' };
       const phaseColor = phaseColors[Math.floor((currentWeekNum - 1) / 3) % phaseColors.length];
       cellWeek.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: phaseColor } };
       cellWeek.border = { left: { style: 'thin', color: { argb: 'FFFFFFFF'} }, right: { style: 'thin', color: { argb: 'FFFFFFFF'} } };
    }

    // Month Grouping
    if (d.getMonth() !== currentMonth || i === daysList.length - 1) {
      let mergeEndCol = colIndex - 1;
      if (i === daysList.length - 1 && d.getMonth() === currentMonth) {
        mergeEndCol = colIndex;
      }
      
      if (mergeEndCol >= monthStartCol) {
        sheet.mergeCells(7, monthStartCol, 7, mergeEndCol);
        const cellMonth = sheet.getCell(7, monthStartCol);
        cellMonth.value = `${monthNames[currentMonth]} ${currentYear}`;
        cellMonth.font = { bold: true, size: 9, color: { argb: 'FF333333' } };
        cellMonth.alignment = { horizontal: 'center', vertical: 'middle' };
        cellMonth.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
        cellMonth.border = { left: { style: 'thin', color: { argb: 'FFFFFFFF'} }, right: { style: 'thin', color: { argb: 'FFFFFFFF'} }, bottom: { style: 'thin', color: { argb: 'FFFFFFFF'} } };
      }

      if (d.getMonth() !== currentMonth) {
         currentMonth = d.getMonth();
         currentYear = d.getFullYear();
         monthStartCol = colIndex;
         
         if (i === daysList.length - 1) {
            sheet.mergeCells(7, monthStartCol, 7, colIndex);
            const cellMonth2 = sheet.getCell(7, monthStartCol);
            cellMonth2.value = `${monthNames[currentMonth]} ${currentYear}`;
            cellMonth2.font = { bold: true, size: 9, color: { argb: 'FF333333' } };
            cellMonth2.alignment = { horizontal: 'center', vertical: 'middle' };
            cellMonth2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
            cellMonth2.border = { left: { style: 'thin', color: { argb: 'FFFFFFFF'} }, right: { style: 'thin', color: { argb: 'FFFFFFFF'} } };
         }
      }
    }
  });

  // 4. Populate Tasks
  let currentRow = 10;
  sortedTasks.forEach((t) => {
    const isMainTask = !t.parent_task_id;
    const row = sheet.getRow(currentRow);
    row.height = 18;
    
    row.getCell(1).value = t.task_order || '';
    row.getCell(1).font = { bold: isMainTask, size: 10 };
    
    // Indent subtasks slightly
    const indent = isMainTask ? '' : '   ';
    row.getCell(2).value = indent + (t.task_name || '');
    row.getCell(2).font = { bold: isMainTask, size: 10 };
    
    row.getCell(3).value = t.assignee_name || '';
    row.getCell(3).font = { size: 10 };
    
    const startDate = getEffectiveStartDate(t);
    const dueDate = getEffectiveEndDate(t);
    
    row.getCell(4).value = startDate ? `${startDate.getMonth()+1}/${startDate.getDate()}/${startDate.getFullYear().toString().slice(-2)}` : '';
    row.getCell(5).value = dueDate ? `${dueDate.getMonth()+1}/${dueDate.getDate()}/${dueDate.getFullYear().toString().slice(-2)}` : '';
    
    let duration = 0;
    if (startDate && dueDate) {
      duration = Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    row.getCell(6).value = duration > 0 ? duration : '';
    row.getCell(6).alignment = { horizontal: 'center' };
    
    let pct = 0;
    if (t.status?.toLowerCase() === 'done' || t.status?.toLowerCase() === 'complete') pct = 100;
    else if (t.percent_complete) pct = Number(t.percent_complete);
    row.getCell(7).value = `${pct}%`;
    row.getCell(7).alignment = { horizontal: 'center' };

    // PCT Coloring
    if (pct === 100) {
      row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
    } else if (pct > 0) {
      row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
    }

    // Set border for table area
    for (let c = 1; c <= 7; c++) {
      row.getCell(c).border = { 
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0'} },
        right: { style: 'thin', color: { argb: 'FFE2E8F0'} }
      };
      if (isMainTask) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      }
    }

    // Timeline Rendering
    if (startDate && dueDate) {
      for (let i = 0; i < daysList.length; i++) {
        const currentDay = daysList[i];
        currentDay.setHours(0,0,0,0);
        const s = new Date(startDate); s.setHours(0,0,0,0);
        const d = new Date(dueDate); d.setHours(0,0,0,0);
        
        const colIndex = i + 8;
        const cell = row.getCell(colIndex);
        
        // Default border grid for timeline
        cell.border = { 
          left: { style: 'thin', color: { argb: 'FFEEEEEE'} }, 
          right: { style: 'thin', color: { argb: 'FFEEEEEE'} }, 
          bottom: { style: 'thin', color: { argb: 'FFEEEEEE'} },
          top: { style: 'thin', color: { argb: 'FFEEEEEE'} }
        };

        if (isMainTask) {
          // Parent task gets light grey shading across entire row in timeline too
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
        }

        if (currentDay >= s && currentDay <= d) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isMainTask ? 'FF7F7F7F' : 'FF5B9BD5' } };
        }
      }
    } else if (isMainTask) {
      // Still color parent row grey even if no dates
      for (let i = 0; i < daysList.length; i++) {
        row.getCell(i + 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
      }
    }

    currentRow++;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${project.project_code || 'Project'}_Gantt.xlsx`);
};

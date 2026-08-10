import { jsPDF } from 'jspdf';
import { ProjectData, TaskData } from '@/interfaces';
import { getEffectiveStartDate, getEffectiveEndDate } from '@/utils/date';
import { getUDTString } from '@/utils/date';

/**
 * Exports a Gantt chart as a PDF that mirrors the XLSX layout:
 *  - Left: static columns (WBS, Task Title, Owner, Start, Due, Duration, %)
 *  - Right: day-by-day grid with colored bars, Week & Month grouped headers
 */
export const exportGanttToPDF = async (project: ProjectData, tasks: TaskData[]) => {
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

  // --- Calculate date range ---
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
    maxDate = new Date(minDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  minDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
  maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());

  // Generate list of days
  const daysList: Date[] = [];
  let curr = new Date(minDate);
  while (curr <= maxDate) {
    daysList.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  // --- Layout constants ---
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth(); // 297mm
  const pageH = pdf.internal.pageSize.getHeight(); // 210mm

  const marginL = 8;
  const marginR = 8;
  const contentW = pageW - marginL - marginR;

  // Left table columns (fixed width in mm)
  const COL_WIDTHS = [10, 55, 22, 16, 16, 14, 12]; // WBS, Title, Owner, Start, Due, Dur, %
  const COL_HEADERS = ['WBS', 'TASK TITLE', 'OWNER', 'START', 'DUE', 'DUR.', '%'];
  const leftTableW = COL_WIDTHS.reduce((a, b) => a + b, 0); // ~145mm

  // Right side = remaining width per day
  const rightW = contentW - leftTableW;
  const dayW = Math.max(rightW / daysList.length, 1.5); // at least 1.5mm per day

  // Row heights
  const headerMonthH = 5;
  const headerWeekH = 5;
  const headerDayH = 5;
  const rowH = 6;

  // Y positions
  const titleY = 10;
  const subtitleY = 16;
  const headerStartY = 22;
  const dataStartY = headerStartY + headerMonthH + headerWeekH + headerDayH;

  const maxContentY = pageH - 10; // bottom margin

  const chartX = marginL + leftTableW; // X where the day grid starts

  // Phase colors (for week headers): mirror XLSX colors
  const phaseColors: [number, number, number][] = [
    [31, 78, 121],
    [84, 130, 53],
    [191, 143, 0],
    [192, 0, 0],
    [112, 48, 160],
  ];

  // --- Helper: draw a single page's header rows ---
  const drawHeaderRows = (y: number) => {
    // Month row
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let monthStartI = 0;
    for (let i = 0; i <= daysList.length; i++) {
      const d = daysList[i];
      const prevD = daysList[i - 1];
      if (i > 0 && (i === daysList.length || d.getMonth() !== prevD.getMonth())) {
        // Draw month block from monthStartI to i-1
        const x = chartX + monthStartI * dayW;
        const w = (i - monthStartI) * dayW;
        pdf.setFillColor(239, 239, 239);
        pdf.rect(x, y, w, headerMonthH, 'F');
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.2);
        pdf.rect(x, y, w, headerMonthH);
        pdf.setFontSize(5.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(50, 50, 50);
        const label = `${monthNames[prevD.getMonth()]} ${prevD.getFullYear()}`;
        pdf.text(label, x + w / 2, y + headerMonthH / 2 + 1, { align: 'center' });
        monthStartI = i;
      }
    }

    // Week row
    let weekNum = 1;
    let weekStartI = 0;
    const weekColors = phaseColors;
    for (let i = 0; i <= daysList.length; i++) {
      const d = daysList[i];
      const prevD = daysList[i - 1];
      if (i > 0 && (i === daysList.length || (d.getDay() === 1 && i !== weekStartI))) {
        const x = chartX + weekStartI * dayW;
        const w = (i - weekStartI) * dayW;
        pdf.setFillColor(68, 84, 106); // Match table header color
        pdf.rect(x, y + headerMonthH, w, headerWeekH, 'F');
        pdf.setFontSize(5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        if (w > 8) pdf.text(`W${weekNum}`, x + w / 2, y + headerMonthH + headerWeekH / 2 + 1, { align: 'center' });
        weekNum++;
        weekStartI = i;
      }
    }

    // Day letter row
    const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    daysList.forEach((d, i) => {
      const x = chartX + i * dayW;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      pdf.setFillColor(isWeekend ? 210 : 242, isWeekend ? 210 : 242, isWeekend ? 210 : 242);
      pdf.rect(x, y + headerMonthH + headerWeekH, dayW, headerDayH, 'F');
      if (dayW > 2.5) {
        pdf.setFontSize(4.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(80, 80, 80);
        pdf.text(dayLetters[d.getDay()], x + dayW / 2, y + headerMonthH + headerWeekH + headerDayH / 2 + 1, { align: 'center' });
      }
    });

    // Left table column headers
    let cx = marginL;
    COL_HEADERS.forEach((header, ci) => {
      const w = COL_WIDTHS[ci];
      const hh = headerMonthH + headerWeekH + headerDayH;
      pdf.setFillColor(68, 84, 106); // dark slate header
      pdf.rect(cx, y, w, hh, 'F');
      pdf.setFontSize(5.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text(header, cx + w / 2, y + hh / 2 + 1, { align: 'center' });
      cx += w;
    });
  };

  // --- Draw Title ---
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 84, 154);
  pdf.text('SOFTWARE PROJECT TIMELINE', marginL, titleY);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 80, 80);
  pdf.text(`Project: ${project.project_name || ''}`, marginL, subtitleY);
  pdf.text(
    `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    pageW - marginR,
    subtitleY,
    { align: 'right' }
  );

  // --- Draw Headers ---
  drawHeaderRows(headerStartY);

  // --- Draw rows ---
  let curY = dataStartY;
  let page = 1;

  sortedTasks.forEach((t, rowIdx) => {
    const isMain = !t.parent_task_id;
    const startDate = getEffectiveStartDate(t);
    const dueDate = getEffectiveEndDate(t);

    // Page break
    if (curY + rowH > maxContentY) {
      pdf.addPage();
      page++;
      curY = 14;
      drawHeaderRows(curY);
      curY += headerMonthH + headerWeekH + headerDayH;
    }

    // Alternating row background (left table area)
    const bgArgb: [number, number, number] = isMain ? [217, 217, 217] : (rowIdx % 2 === 0 ? [255, 255, 255] : [247, 250, 252]);
    pdf.setFillColor(...bgArgb);
    pdf.rect(marginL, curY, leftTableW, rowH, 'F');

    // Draw left column borders
    let cx = marginL;
    COL_WIDTHS.forEach((w, ci) => {
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.15);
      pdf.rect(cx, curY, w, rowH);
      cx += w;
    });

    // Cell texts
    const textColor: [number, number, number] = isMain ? [30, 30, 30] : [60, 60, 60];
    pdf.setTextColor(...textColor);
    pdf.setFont('helvetica', isMain ? 'bold' : 'normal');

    // WBS
    pdf.setFontSize(6);
    pdf.text(t.task_order || '', marginL + 1, curY + rowH / 2 + 1);

    // Title (indent subtasks)
    const indent = isMain ? 0 : 3;
    const rawTitle = t.task_name || '';
    const maxTitleChars = 30;
    const titleStr = rawTitle.length > maxTitleChars ? rawTitle.slice(0, maxTitleChars) + '…' : rawTitle;
    pdf.text(titleStr, marginL + COL_WIDTHS[0] + indent + 1, curY + rowH / 2 + 1);

    // Owner
    const ownerStr = (t.assignee_name || '').slice(0, 14);
    pdf.setFont('helvetica', 'normal');
    pdf.text(ownerStr, marginL + COL_WIDTHS[0] + COL_WIDTHS[1] + 1, curY + rowH / 2 + 1);

    // Start
    const startStr = startDate
      ? `${startDate.getDate().toString().padStart(2, '0')}/${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getFullYear().toString().slice(-2)}`
      : '';
    const col3x = marginL + COL_WIDTHS[0] + COL_WIDTHS[1] + COL_WIDTHS[2];
    pdf.text(startStr, col3x + COL_WIDTHS[3] / 2, curY + rowH / 2 + 1, { align: 'center' });

    // Due
    const dueStr = dueDate
      ? `${dueDate.getDate().toString().padStart(2, '0')}/${(dueDate.getMonth() + 1).toString().padStart(2, '0')}/${dueDate.getFullYear().toString().slice(-2)}`
      : '';
    const col4x = col3x + COL_WIDTHS[3];
    pdf.text(dueStr, col4x + COL_WIDTHS[4] / 2, curY + rowH / 2 + 1, { align: 'center' });

    // Duration
    let dur = 0;
    if (startDate && dueDate) {
      dur = Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    const col5x = col4x + COL_WIDTHS[4];
    if (dur > 0) pdf.text(dur.toString(), col5x + COL_WIDTHS[5] / 2, curY + rowH / 2 + 1, { align: 'center' });

    // PCT
    let pct = 0;
    if (t.status?.toLowerCase() === 'done' || t.status?.toLowerCase() === 'complete') pct = 100;
    else if (t.percent_complete) pct = Number(t.percent_complete);
    const col6x = col5x + COL_WIDTHS[5];
    // Color the pct cell
    if (pct === 100) {
      pdf.setFillColor(146, 208, 80);
      pdf.rect(col6x, curY, COL_WIDTHS[6], rowH, 'F');
    } else if (pct > 0) {
      pdf.setFillColor(198, 224, 180);
      pdf.rect(col6x, curY, COL_WIDTHS[6], rowH, 'F');
    }
    pdf.setTextColor(30, 30, 30);
    pdf.text(`${pct}%`, col6x + COL_WIDTHS[6] / 2, curY + rowH / 2 + 1, { align: 'center' });
    // redraw border
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.15);
    pdf.rect(col6x, curY, COL_WIDTHS[6], rowH);

    // --- Timeline grid for this row ---
    daysList.forEach((d, i) => {
      const x = chartX + i * dayW;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const dNorm = new Date(d); dNorm.setHours(0, 0, 0, 0);

      // Background
      let fillR = isMain ? 239 : (isWeekend ? 232 : 255);
      let fillG = isMain ? 239 : (isWeekend ? 232 : 255);
      let fillB = isMain ? 239 : (isWeekend ? 232 : 255);

      // Bar fill: is this day within task range?
      let isBarDay = false;
      if (startDate && dueDate) {
        const s = new Date(startDate); s.setHours(0, 0, 0, 0);
        const e = new Date(dueDate); e.setHours(0, 0, 0, 0);
        if (dNorm >= s && dNorm <= e) {
          isBarDay = true;
          // Determine color based on status
          const stat = (t.status || '').toLowerCase();
          if (stat === 'done' || stat === 'complete') {
            fillR = 84; fillG = 130; fillB = 53; // green
          } else if (stat === 'on hold') {
            fillR = 255; fillG = 192; fillB = 0; // amber
          } else if (dueDate && new Date(dueDate).getTime() < today.getTime() && pct < 100) {
            fillR = 255; fillG = 0; fillB = 0; // red (overdue)
          } else {
            fillR = 91; fillG = 155; fillB = 213; // default blue
          }
        }
      }

      pdf.setFillColor(fillR, fillG, fillB);
      pdf.rect(x, curY, dayW, rowH, 'F');

      // Grid lines
      if (dayW > 2) {
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.1);
        pdf.rect(x, curY, dayW, rowH);
      }

      // "Today" marker
      if (!isBarDay && dNorm.getTime() === today.getTime()) {
        pdf.setFillColor(239, 68, 68, 0.4);
        pdf.setDrawColor(239, 68, 68);
        pdf.setLineWidth(0.5);
        pdf.line(x, curY, x, curY + rowH);
      }
    });

    curY += rowH;
  });

  // Bottom border
  pdf.setDrawColor(99, 102, 241);
  pdf.setLineWidth(0.4);
  pdf.line(marginL, curY, pageW - marginR, curY);

  // Footer
  const totalPages = (pdf.internal as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `${project.project_code || ''} | ${project.project_name || ''} | Page ${p} of ${totalPages}`,
      pageW / 2,
      pageH - 5,
      { align: 'center' }
    );
  }

  pdf.save(`${project.project_name || 'Project'}_Timeline${getUDTString()}.pdf`);
};

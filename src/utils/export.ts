import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Task } from 'gantt-task-react';
import { ProjectData, TaskData } from '@/interfaces';
import { formatDateYYYYMMDD, formatDateDDMMYYYY, getUDTString } from '@/utils/date';
import { calculateTaskProgress, calculateProjectProgress } from '@/utils/progress';
import { isTaskOverdue } from '@/utils/status';

export const exportToExcel = (tasks: Task[], project: ProjectData) => {
  const exportData = tasks.filter(t => t.id !== 'dummy-padding').map(t => {
    const dur = (t as any).duration || (t as any).plannedDuration;
    return {
      'Task Order': (t as any).task_order,
      'Task Name': t.name.replace(/^\d+\.\s/, ''),
      'Assignee': (t as any).assignee || '',
      'Duration (Days)': dur ? `${dur}d` : '',
      'Start Date': (t as any).actualStartDate ? formatDateYYYYMMDD((t as any).actualStartDate) : '',
      'Due Date': (t as any).actualDueDate ? formatDateYYYYMMDD((t as any).actualDueDate) : '',
      'End Date (Actual)': (t as any).actualEndDate ? formatDateYYYYMMDD((t as any).actualEndDate) : '',
      'Status': (t as any).originalStatus,
      'Progress (%)': `${Math.round((t as any).realProgress)}%`
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');

  const wscols = [
    { wch: 10 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 12 }
  ];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, `${project.project_name || 'Project'}_Timeline${getUDTString()}.xlsx`);
};

export const exportToPDF = async (tasks: Task[], rawTasks: TaskData[], project: ProjectData, exporterName: string = 'Unknown User', returnBase64: boolean = false) => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;

  const HEADER_H = 22;
  const FOOTER_H = 14;
  const contentStartY = HEADER_H + 4;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let projectDuration = '';
  let projectDurationLong = '';
  if (project.start_date && project.end_date) {
    const s = new Date(project.start_date);
    const e = new Date(project.end_date);
    const days = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (!isNaN(days) && days > 0) {
      projectDuration = ` | Duration: ${days} days`;
      projectDurationLong = `  |  Duration: ${days} days (${formatDateDDMMYYYY(project.start_date)} - ${formatDateDDMMYYYY(project.end_date)})`;
    }
  }

  // =============================================
  // Helper: draw header + footer on current page
  // =============================================
  const drawHeaderFooter = (pdf: jsPDF, pageNum: number, totalPages: number, subtitle: string) => {
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();

    // Header background
    pdf.setFillColor(30, 41, 59); // slate-800
    pdf.rect(0, 0, W, HEADER_H, 'F');

    // Accent stripe
    pdf.setFillColor(99, 102, 241); // emerald-500
    pdf.rect(0, HEADER_H - 2, W, 2, 'F');

    // Project name
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text(project.project_name || 'Project', marginL, 9);

    // Subtitle
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(148, 163, 184); // slate-400
    pdf.text(`${subtitle}${projectDuration}`, marginL, 16);

    // Right: page number
    pdf.setFontSize(8);
    pdf.setTextColor(200, 210, 230);
    pdf.text(`Page ${pageNum}${totalPages ? ` of ${totalPages}` : ''}`, W - marginR, 9, { align: 'right' });
    pdf.setFontSize(6.5);
    pdf.text(`Exported: ${new Date().toLocaleString('th-TH')}  |  By: ${exporterName}`, W - marginR, 16, { align: 'right' });

    // Footer line
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.3);
    pdf.line(marginL, H - FOOTER_H, W - marginR, H - FOOTER_H);
    pdf.setFontSize(6.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text(project.project_code || '', marginL, H - FOOTER_H + 5);
    pdf.text(`Page ${pageNum}${totalPages ? ` of ${totalPages}` : ''}`, W - marginR, H - FOOTER_H + 5, { align: 'right' });
  };

  // =============================================
  // PAGE 1+: Task Detail Table
  // =============================================
  const validTasks = tasks.filter(t => t.id !== 'dummy-padding');

  const getDepth = (t: any): number => {
    if (!t.parent_task_id) return 0;
    const parent = tasks.find(pt => pt.id === t.parent_task_id);
    if (!parent) return 0;
    return 1 + getDepth(parent);
  };

  const tableRows: any[] = [];
  validTasks.forEach(t => {
    const depth = getDepth(t);
    const indent = '  '.repeat(depth * 2);
    const cleanName = t.name.replace(/^\d+(\.\d+)*\.\s/, '');
    const statusStr = (t as any).originalStatus || '-';
    const sLow = statusStr.toLowerCase();
    const isDoneStatus = sLow.includes('done') || sLow.includes('complete') || sLow.includes('cancel');
    const isOverdue = isTaskOverdue(statusStr, (t as any).actualDueDate);

    const plannedDur = (t as any).plannedDuration;
    const actualDur = (t as any).duration;

    let assigneeName = (t as any).assignee || '-';
    if (assigneeName !== '-') {
      const parts = assigneeName.trim().split(/\s+/);
      if (parts.length >= 2) {
        assigneeName = `${parts[0]} ${parts[1].substring(0, 2)}.`;
      }
    }

    tableRows.push([
      (t as any).task_order || '-',
      indent + cleanName,
      assigneeName,
      plannedDur != null ? `${plannedDur}d` : '-',
      actualDur != null ? `${actualDur}d` : '-',
      (t as any).actualStartDate ? formatDateYYYYMMDD((t as any).actualStartDate) : '-',
      (t as any).actualDueDate ? formatDateYYYYMMDD((t as any).actualDueDate) : '-',
      (t as any).actualUpdateDate ? formatDateYYYYMMDD((t as any).actualUpdateDate) : '-',
      isOverdue ? `${statusStr}*` : statusStr,
      `${Math.round((t as any).realProgress)}%`
    ]);
  });

  autoTable(pdf, {
    head: [['#', 'Task Name', 'Assignee', 'Plan Dur.', 'Act. Dur.', 'Start', 'Due', 'Act. End', 'Status', '%']],
    body: tableRows,
    startY: contentStartY + 2,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, lineColor: [226, 232, 240], lineWidth: 0.2, textColor: [51, 65, 85] },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: HEADER_H + 6, left: marginL, right: marginR, bottom: FOOTER_H + 4 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 24 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 20, halign: 'center' },
      8: { cellWidth: 22, halign: 'center' },
      9: { cellWidth: 12, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'head') return;
      if (data.column.index === 4) {
        const rawRow = data.row.raw as string[];
        const planStr = (rawRow[3] || '').replace('d', '');
        const actStr = (rawRow[4] || '').replace('d', '');
        const planVal = parseInt(planStr);
        const actVal = parseInt(actStr);
        if (!isNaN(planVal) && !isNaN(actVal) && actVal > planVal) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.column.index === 8) {
        const text = data.cell.text[0] || '';
        const tl = text.toLowerCase();
        if (text.includes('*') || tl.includes('overdue')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (tl.includes('done') || tl.includes('complete')) {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else if (tl.includes('progress') || tl.includes('doing')) {
          data.cell.styles.textColor = [37, 99, 235];
        } else if (tl.includes('review')) {
          data.cell.styles.textColor = [109, 40, 217];
        } else if (tl.includes('hold')) {
          data.cell.styles.textColor = [180, 120, 0];
        } else if (tl.includes('cancel')) {
          data.cell.styles.textColor = [100, 116, 139];
        }
      }
      if (data.column.index === 9) {
        const pct = parseInt(data.cell.text[0]);
        if (pct === 100) data.cell.styles.textColor = [5, 150, 105];
        else if (pct >= 75) data.cell.styles.textColor = [37, 99, 235];
        else if (pct > 0) data.cell.styles.textColor = [180, 100, 0];
      }
    },
    didDrawPage: (data) => {
      // Header/footer will be drawn at the end for all pages
    },
  });

  // =============================================
  // PAGE: Gantt Chart (all tasks, new page)
  // =============================================
  if (validTasks.length > 0) {
    pdf.addPage();
    const ganttPageNum = (pdf.internal as any).getCurrentPageInfo().pageNumber;

    // Find date range
    let minDate = new Date(validTasks[0].start);
    let maxDate = new Date(validTasks[0].end);
    validTasks.forEach(t => {
      if (t.start < minDate) minDate = new Date(t.start);
      if (t.end > maxDate) maxDate = new Date(t.end);
    });

    // Only ensure "Today" is within the chart bounds if project is NOT 100% complete
    const currentProgress = calculateProjectProgress(rawTasks);
    if (currentProgress < 100) {
      if (minDate > today) minDate = new Date(today);
      if (maxDate < today) maxDate = new Date(today);
    }

    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(23, 59, 59, 999);
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 7);

    const totalMs = maxDate.getTime() - minDate.getTime();
    const chartStartX = marginL + 75;
    const chartEndX = pageW - marginR;
    const chartW = chartEndX - chartStartX;
    const rowH = 7;
    const barH = 4;
    const ganttStartY = contentStartY + 8;
    const maxContentY = pageH - FOOTER_H - 6;

    // Draw "Today" vertical reference on the gantt
    const drawTodayLine = (startY: number, endY: number) => {
      const todayOffset = today.getTime() - minDate.getTime();
      if (todayOffset > 0 && todayOffset < totalMs) {
        const todayX = chartStartX + (todayOffset / totalMs) * chartW;
        pdf.setDrawColor(239, 68, 68); // red
        pdf.setLineWidth(0.5);
        // Dashed line
        for (let y2 = startY; y2 < endY; y2 += 2.5) {
          pdf.line(todayX, y2, todayX, Math.min(y2 + 1.5, endY));
        }
        pdf.setFontSize(6);
        pdf.setTextColor(239, 68, 68);
        pdf.text('Today', todayX + 0.5, startY - 1, { baseline: 'bottom' });
      }
    };

    const drawMonthHeaders = (startY: number) => {
      // Grey band header for months
      let iter = new Date(minDate);
      iter.setDate(1);

      pdf.setFontSize(6.5);
      while (iter < maxDate) {
        const offset = iter.getTime() - minDate.getTime();
        const lx = chartStartX + (offset / totalMs) * chartW;
        const nextMonth = new Date(iter);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextOffset = nextMonth.getTime() - minDate.getTime();
        const nx = chartStartX + (nextOffset / totalMs) * chartW;
        const cellW = Math.min(nx, chartEndX) - Math.max(lx, chartStartX);

        if (cellW > 0) {
          const cx = Math.max(lx, chartStartX);
          // Alternating month header colors
          const isEven = iter.getMonth() % 2 === 0;
          pdf.setFillColor(isEven ? 241 : 248, isEven ? 245 : 250, 255);
          pdf.rect(cx, startY - rowH, cellW, rowH, 'F');
          pdf.setDrawColor(203, 213, 225);
          pdf.setLineWidth(0.2);
          pdf.line(cx, startY - rowH, cx, startY);
          pdf.setTextColor(71, 85, 105);
          const label = iter.toLocaleString('en-US', { month: 'short', year: '2-digit' });
          pdf.text(label, cx + cellW / 2, startY - rowH / 2 + 1.5, { align: 'center', baseline: 'middle' });
        }
        iter.setMonth(iter.getMonth() + 1);
      }

      // Bottom border of month header
      pdf.setDrawColor(99, 102, 241);
      pdf.setLineWidth(0.5);
      pdf.line(marginL, startY, chartEndX, startY);

      // Task Name Header
      pdf.setFillColor(241, 245, 249);
      pdf.rect(marginL, startY - rowH, chartStartX - marginL, rowH, 'F');
      pdf.setFontSize(7);
      pdf.setTextColor(71, 85, 105);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Task Name', marginL + 2, startY - rowH / 2 + 1.5, { baseline: 'middle' });
      pdf.setFont('helvetica', 'normal');
    };

    // Section title
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text('Project Gantt Chart', marginL, contentStartY + 4);
    pdf.setFont('helvetica', 'normal');

    let curY = ganttStartY + rowH; // leave space for month header row

    drawMonthHeaders(curY);
    curY += 5; // generous gap after month header

    // Legend
    const legendY = curY;
    const legends = [
      { label: 'To Do / Plan', r: 236, g: 72, b: 153 },
      { label: 'Done', r: 16, g: 185, b: 129 },
      { label: 'In Progress', r: 59, g: 130, b: 246 },
      { label: 'Overdue', r: 239, g: 68, b: 68 },
      { label: 'Review', r: 124, g: 58, b: 237 },
      { label: 'Hold', r: 245, g: 158, b: 11 },
      { label: 'Cancelled', r: 148, g: 163, b: 184 },
    ];
    let lx = chartStartX;
    legends.forEach(leg => {
      pdf.setFillColor(leg.r, leg.g, leg.b);
      pdf.roundedRect(lx, legendY - 2.5, 3, 3, 0.5, 0.5, 'F');
      pdf.setFontSize(6);
      pdf.setTextColor(71, 85, 105);
      pdf.text(leg.label, lx + 4, legendY, { baseline: 'middle' });
      // Fixed spacing to prevent overlap
      const spacing = leg.label === 'In Progress' ? 22 : leg.label === 'To Do / Plan' ? 24 : leg.label === 'Cancelled' ? 20 : 16;
      lx += spacing;
    });
    curY += 6; // generous gap before tasks

    // Track gantt chart drawing Y range for today line
    const ganttBodyStartY = curY;
    let ganttBodyEndY = curY;

    // Draw each task row
    validTasks.forEach((t, i) => {
      // New page if needed
      if (curY + rowH > maxContentY) {
        // Draw today line before page break
        drawTodayLine(ganttBodyStartY, curY);
        pdf.addPage();
        drawHeaderFooter(pdf, (pdf.internal as any).getCurrentPageInfo().pageNumber, 0, 'Gantt Chart (continued)');
        curY = contentStartY + 4;

        // Re-draw month headers on new page
        curY += rowH;
        drawMonthHeaders(curY);
        curY += 1;
      }

      // Alternating row background
      if (i % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(marginL, curY, contentW, rowH, 'F');
      }

      // Grid lines (vertical per month)
      let gridIter = new Date(minDate);
      gridIter.setDate(1);
      if (gridIter < minDate) gridIter.setMonth(gridIter.getMonth() + 1);
      while (gridIter < maxDate) {
        const gOffset = gridIter.getTime() - minDate.getTime();
        const gx = chartStartX + (gOffset / totalMs) * chartW;
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.1);
        pdf.line(gx, curY, gx, curY + rowH);
        gridIter.setMonth(gridIter.getMonth() + 1);
      }

      // Horizontal row border
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.1);
      pdf.line(marginL, curY + rowH, chartEndX, curY + rowH);

      // Task name (left side)
      const depth = getDepth(t);
      const nameIndent = marginL + depth * 4;
      const cleanName = t.name.replace(/^\d+(\.\d+)*\.\s/, '');
      const shortName = cleanName.substring(0, depth > 0 ? 30 : 35) + (cleanName.length > (depth > 0 ? 30 : 35) ? 'â€¦' : '');
      const isParent = (t as any).type === 'project';

      pdf.setFontSize(6.5);
      pdf.setFont('helvetica', isParent ? 'bold' : 'normal');
      pdf.setTextColor(isParent ? 30 : 71, isParent ? 41 : 85, isParent ? 59 : 105);
      pdf.text(shortName, nameIndent, curY + rowH / 2 + 1, { baseline: 'middle' });

      // Bar
      const taskStartOff = t.start.getTime() - minDate.getTime();
      const taskDur = t.end.getTime() - t.start.getTime();
      const barX = chartStartX + (taskStartOff / totalMs) * chartW;
      const barW = Math.max((taskDur / totalMs) * chartW, 2);

      const s = ((t as any).originalStatus || '').toLowerCase();
      let r = 59, g = 130, b = 246;
      if (s.includes('done') || s.includes('complete')) { r = 16; g = 185; b = 129; }
      else if (s.includes('cancel')) { r = 148; g = 163; b = 184; }
      else if (s.includes('hold')) { r = 245; g = 158; b = 11; }
      else if (s.includes('review')) { r = 124; g = 58; b = 237; }
      else {
        const due = new Date((t as any).actualDueDate);
        due.setHours(0, 0, 0, 0);
        if (due < today && !(s.includes('done') || s.includes('cancel'))) { r = 239; g = 68; b = 68; }
      }

      const barY = curY + (rowH - barH) / 2;

      // Calculate track color (lightened version of the status color)
      let trackR = 251, trackG = 218, trackB = 234; // Default To Do track (Light Pink)
      
      const isCancelled = s.includes('cancel');
      const isToDo = (!isCancelled && !s.includes('done') && !s.includes('complete') && !s.includes('progress') && !s.includes('doing') && !s.includes('review') && !s.includes('hold'));

      if (!isToDo && !isCancelled) {
        // Blend status color with white (approx 20% opacity)
        trackR = Math.round(255 - 0.2 * (255 - r));
        trackG = Math.round(255 - 0.2 * (255 - g));
        trackB = Math.round(255 - 0.2 * (255 - b));
      }

      // Background track
      pdf.setFillColor(trackR, trackG, trackB);
      pdf.roundedRect(barX, barY, barW, barH, 0.8, 0.8, 'F');

      // Progress fill
      const progress = Math.max(0, Math.min(100, (t as any).realProgress || 0));
      
      if (isCancelled) {
        // If cancelled, fill the whole bar with cancelled color
        pdf.setFillColor(148, 163, 184);
        pdf.roundedRect(barX, barY, barW, barH, 0.8, 0.8, 'F');
      } else if (progress > 0) {
        pdf.setFillColor(r, g, b);
        const fillW = Math.max((progress / 100) * barW, 1);
        pdf.roundedRect(barX, barY, fillW, barH, 0.8, 0.8, 'F');
      }

      // Progress text inside/beside bar if bar is wide enough
      if (barW > 10) {
        pdf.setFontSize(5);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${Math.round(progress)}%`, barX + barW / 2, barY + barH / 2 + 0.8, { align: 'center' });
      }

      ganttBodyEndY = curY + rowH;
      curY += rowH;
    });

    // Draw today line
    if (currentProgress < 100) {
      drawTodayLine(ganttBodyStartY, ganttBodyEndY);
    }

    // Vertical line separating task names and chart
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.2);
    pdf.line(chartStartX, ganttStartY, chartStartX, ganttBodyEndY);

    // Bottom axis line
    pdf.setDrawColor(99, 102, 241);
    pdf.setLineWidth(0.4);
    pdf.line(marginL, curY, chartEndX, curY);
  }

  // =============================================
  // PAGE LAST: Performance Summary (always new page)
  // =============================================
  pdf.addPage();
  const summaryPageNum = (pdf.internal as any).getCurrentPageInfo().pageNumber;

  const totalTasks = validTasks.length;
  const doneTasks = validTasks.filter(t => {
    const s = ((t as any).originalStatus || '').toLowerCase();
    return s.includes('done') || s.includes('complete');
  }).length;
  const cancelledTasks = validTasks.filter(t => ((t as any).originalStatus || '').toLowerCase().includes('cancel')).length;
  const overdueTasks = validTasks.filter(t => {
    const s = ((t as any).originalStatus || '').toLowerCase();
    if (s.includes('done') || s.includes('complete') || s.includes('cancel')) return false;
    const due = new Date((t as any).actualDueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }).length;
  const inProgressTasks = validTasks.filter(t => {
    const s = ((t as any).originalStatus || '').toLowerCase();
    return s.includes('progress') || s.includes('doing');
  }).length;
  const reviewTasks = validTasks.filter(t => ((t as any).originalStatus || '').toLowerCase().includes('review')).length;
  const holdTasks = validTasks.filter(t => ((t as any).originalStatus || '').toLowerCase().includes('hold')).length;
  const todoTasks = validTasks.filter(t => {
    const s = ((t as any).originalStatus || '').toLowerCase();
    return !s.includes('done') && !s.includes('complete') && !s.includes('cancel') && !s.includes('progress') && !s.includes('doing') && !s.includes('review') && !s.includes('hold');
  }).length;

  let projectHealth = 'On Track';
  let healthR = 5, healthG = 150, healthB = 105;
  if (overdueTasks > 0) { projectHealth = 'Delayed'; healthR = 220; healthG = 38; healthB = 38; }
  else if (doneTasks === totalTasks && totalTasks > 0) { projectHealth = 'Completed'; healthR = 99; healthG = 102; healthB = 241; }

  const overallProgress = calculateProjectProgress(rawTasks);

  drawHeaderFooter(pdf, summaryPageNum, 0, 'Project Performance Summary');

  let sy = contentStartY + 5;

  // â”€â”€ HEADER BLOCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text('Project Performance Summary', marginL, sy);
  sy += 5;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `${project.project_name || '-'}  (${project.project_code || '-'})${projectDurationLong}  |  Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    marginL, sy
  );
  sy += 3;

  // Divider
  pdf.setDrawColor(99, 102, 241);
  pdf.setLineWidth(1.2);
  pdf.line(marginL, sy, pageW - marginR, sy);
  sy += 7;

  // â”€â”€ HEALTH + PROGRESS BAR (full width) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Health badge
  pdf.setFillColor(healthR, healthG, healthB);
  pdf.roundedRect(marginL, sy, 35, 9, 2, 2, 'F');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text(projectHealth.toUpperCase(), marginL + 17.5, sy + 6, { align: 'center' });

  // Progress bar track
  const pbX = marginL + 40;
  const pbW = contentW - 40 - 22;
  pdf.setFillColor(226, 232, 240);
  pdf.roundedRect(pbX, sy + 1, pbW, 7, 2, 2, 'F');
  // Fill
  if (overallProgress > 0) {
    pdf.setFillColor(healthR, healthG, healthB);
    pdf.roundedRect(pbX, sy + 1, Math.max(overallProgress / 100 * pbW, 3), 7, 2, 2, 'F');
  }
  // Progress label on bar
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  if (overallProgress > 10) {
    pdf.text(`${overallProgress}%`, pbX + Math.max(overallProgress / 100 * pbW, 3) - 2, sy + 6.3, { align: 'right' });
  }
  // % label at end
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text(`${overallProgress}%`, pbX + pbW + 3, sy + 7);
  sy += 16;

  // â”€â”€ KPI TILES (7 tiles in one row) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const kpiItems = [
    { label: 'Total', value: totalTasks, r: 99, g: 102, b: 241 },
    { label: 'Done', value: doneTasks, r: 16, g: 185, b: 129 },
    { label: 'In Progress', value: inProgressTasks, r: 59, g: 130, b: 246 },
    { label: 'To Do', value: todoTasks, r: 236, g: 72, b: 153 },
    { label: 'Review', value: reviewTasks, r: 124, g: 58, b: 237 },
    { label: 'Hold', value: holdTasks, r: 245, g: 158, b: 11 },
    { label: 'Overdue', value: overdueTasks, r: 239, g: 68, b: 68 },
    { label: 'Cancelled', value: cancelledTasks, r: 100, g: 116, b: 139 },
  ];
  const tileGap = 3;
  const tileW = (contentW - tileGap * (kpiItems.length - 1)) / kpiItems.length;
  const tileH = 18;
  kpiItems.forEach((k, i) => {
    const tx = marginL + i * (tileW + tileGap);
    // bg
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(tx, sy, tileW, tileH, 2, 2, 'F');
    // top accent bar
    pdf.setFillColor(k.r, k.g, k.b);
    pdf.roundedRect(tx, sy, tileW, 2.5, 1, 1, 'F');
    // value
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(k.r, k.g, k.b);
    pdf.text(k.value.toString(), tx + tileW / 2, sy + 12, { align: 'center' });
    // label
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(k.label, tx + tileW / 2, sy + tileH - 2, { align: 'center' });
  });
  sy += tileH + 8;

  // ——————————————————————————————————————————————————————————————————————————————  // ── STATUS BREAKDOWN BARS & PIE CHART ──────────────────────────────────────
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text('Status Breakdown', marginL, sy);
  sy += 5;

  const drawDonut = (cx: number, cy: number, radius: number, data: typeof bars) => {
    const total = data.reduce((sum, d) => sum + d.count, 0);
    if (total === 0) {
      pdf.setFillColor(226, 232, 240);
      pdf.circle(cx, cy, radius, 'F');
      pdf.setFillColor(255, 255, 255);
      pdf.circle(cx, cy, radius * 0.6, 'F');
      return;
    }
    let startAngle = -Math.PI / 2;
    data.forEach(d => {
      if (d.count === 0) return;
      const sliceAngle = (d.count / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      
      pdf.setFillColor(d.r, d.g, d.b);
      const steps = Math.max(2, Math.ceil((sliceAngle / (2 * Math.PI)) * 60)); 
      const stepAngle = sliceAngle / steps;
      
      for (let i = 0; i < steps; i++) {
        const a1 = startAngle + i * stepAngle;
        const a2 = startAngle + (i + 1) * stepAngle;
        const x1 = cx + radius * Math.cos(a1);
        const y1 = cy + radius * Math.sin(a1);
        const x2 = cx + radius * Math.cos(a2);
        const y2 = cy + radius * Math.sin(a2);
        pdf.triangle(cx, cy, x1, y1, x2, y2, 'F');
      }
      startAngle = endAngle;
    });
    
    // Inner circle for donut
    pdf.setFillColor(255, 255, 255);
    pdf.circle(cx, cy, radius * 0.6, 'F');
    
    // Total text in center
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text(total.toString(), cx, cy + 1.5, { align: 'center', baseline: 'middle' });
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text('TASKS', cx, cy + 5.5, { align: 'center', baseline: 'middle' });
  };

  const bars = [
    { label: 'Done / Complete', count: doneTasks, r: 16, g: 185, b: 129 },
    { label: 'In Progress', count: inProgressTasks, r: 59, g: 130, b: 246 },
    { label: 'To Do / Plan', count: todoTasks, r: 236, g: 72, b: 153 },
    { label: 'In Review', count: reviewTasks, r: 124, g: 58, b: 237 },
    { label: 'On Hold', count: holdTasks, r: 245, g: 158, b: 11 },
    { label: 'Overdue', count: overdueTasks, r: 239, g: 68, b: 68 },
    { label: 'Cancelled', count: cancelledTasks, r: 100, g: 116, b: 139 },
  ];

  const barSectionW = contentW * 0.65;
  const labelColW = 40;
  const countColW = 14;
  const pctColW = 14;
  const barColX = marginL + labelColW + 2;
  const barColW = barSectionW - labelColW - countColW - pctColW - 8;
  const rowH2 = 8;
  const startSy = sy;

  bars.forEach(b => {
    const barPct = totalTasks > 0 ? b.count / totalTasks : 0;

    // Label
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(b.label, marginL, sy + rowH2 - 1.5);

    // Bar track
    pdf.setFillColor(241, 245, 249);
    pdf.roundedRect(barColX, sy + 1, barColW, rowH2 - 3, 1, 1, 'F');

    // Bar fill
    if (barPct > 0) {
      pdf.setFillColor(b.r, b.g, b.b);
      pdf.roundedRect(barColX, sy + 1, Math.max(barPct * barColW, 2), rowH2 - 3, 1, 1, 'F');
    }

    // Count
    const countX = barColX + barColW + 3;
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text(b.count.toString(), countX + countColW / 2, sy + rowH2 - 1.5, { align: 'center' });

    // Percent
    const pctX = countX + countColW + 2;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${Math.round(barPct * 100)}%`, pctX + pctColW / 2, sy + rowH2 - 1.5, { align: 'center' });

    sy += rowH2 + 1;
  });

  // Total row
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, sy, marginL + barSectionW, sy);
  sy += 3;
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  pdf.text('Total', marginL, sy + 5);
  pdf.text(totalTasks.toString(), barColX + barColW + 3 + countColW / 2, sy + 5, { align: 'center' });
  pdf.setTextColor(99, 102, 241);
  pdf.text('100%', barColX + barColW + 3 + countColW + 2 + pctColW / 2, sy + 5, { align: 'center' });
  sy += 12;

  // Draw Donut Chart on the right side
  const pieData = bars.filter(b => b.label !== 'Overdue'); // Exclude overdue as it overlaps
  const cx = marginL + barSectionW + (contentW - barSectionW) / 2;
  const cy = startSy + 32;
  const radius = 24;
  drawDonut(cx, cy, radius, pieData);

  // â”€â”€ WARNING BANNER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (overdueTasks > 0) {
    pdf.setFillColor(255, 241, 242);
    pdf.roundedRect(marginL, sy, contentW, 10, 2, 2, 'F');
    pdf.setFillColor(239, 68, 68);
    pdf.roundedRect(marginL, sy, 3, 10, 1, 1, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(185, 28, 28);
    pdf.text(`! ATTENTION: ${overdueTasks} task(s) are overdue and require immediate action.`, marginL + 7, sy + 7);
  }

  // =============================================
  // Re-draw all headers/footers with CORRECT total page count
  // =============================================
  const totalPages = (pdf.internal as any).getNumberOfPages();
  const pageSubtitles: { [k: number]: string } = {};

  // Mark page subtitles
  for (let i = 1; i <= totalPages; i++) {
    if (i === totalPages) pageSubtitles[i] = 'Project Performance Summary';
    else if (i === totalPages - 1 && validTasks.length > 0) pageSubtitles[i] = 'Gantt Chart';
    else pageSubtitles[i] = 'Task Detail Report';
  }

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    drawHeaderFooter(pdf, i, totalPages, pageSubtitles[i] || 'Task Detail Report');
  }

  const filename = `${project.project_name || 'Project'}_Timeline${getUDTString()}.pdf`;

  if (returnBase64) {
    return {
      filename,
      base64: pdf.output('datauristring')
    };
  } else {
    pdf.save(filename);
  }
};

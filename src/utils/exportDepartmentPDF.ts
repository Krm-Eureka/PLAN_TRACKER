import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProjectData, UserData } from '@/interfaces';
import { formatDateYYYYMMDD, getUDTString } from '@/utils/date';
import { isProjectOverdue } from '@/utils/status';

export const exportDepartmentPDF = async (projects: ProjectData[], users: UserData[], department: string, exporterName: string = 'Unknown User') => {
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
    pdf.setFillColor(99, 102, 241); // indigo-500
    pdf.rect(0, HEADER_H - 2, W, 2, 'F');

    // Report name
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    const deptDisplay = department ? department.toUpperCase() : 'ALL DEPARTMENTS';
    pdf.text(`${deptDisplay} - PROJECT REPORT`, marginL, 9);

    // Subtitle
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(148, 163, 184); // slate-400
    pdf.text(subtitle, marginL, 16);

    // Right: page number
    pdf.setFontSize(8);
    pdf.setTextColor(200, 210, 230);
    pdf.text(`Page ${pageNum}${totalPages ? ` of ${totalPages}` : ''}`, W - marginR, 9, { align: 'right' });
    pdf.setFontSize(6.5);
    pdf.text(`Exported: ${new Date().toLocaleString('en-US')}  |  By: ${exporterName}`, W - marginR, 16, { align: 'right' });

    // Footer line
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.3);
    pdf.line(marginL, H - FOOTER_H, W - marginR, H - FOOTER_H);
    pdf.setFontSize(6.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text('Internal IT Tracker System', marginL, H - FOOTER_H + 5);
    pdf.text(`Page ${pageNum}${totalPages ? ` of ${totalPages}` : ''}`, W - marginR, H - FOOTER_H + 5, { align: 'right' });
  };

  // =============================================
  // PAGE 1: Performance Summary 
  // =============================================
  const summaryPageNum = 1;

  // Variables for Performance Summary metrics
  const totalProjects = projects.length;
  const doneProjects = projects.filter(p => {
    const s = (p.status || '').toLowerCase();
    return s.includes('done') || s.includes('complete');
  }).length;
  const cancelledProjects = projects.filter(p => (p.status || '').toLowerCase().includes('cancel')).length;
  const overdueProjects = projects.filter(p => {
    const s = (p.status || '').toLowerCase();
    if (s.includes('done') || s.includes('complete') || s.includes('cancel')) return false;
    if (p.end_date) {
      const due = new Date(p.end_date);
      due.setHours(0, 0, 0, 0);
      return due < today;
    }
    return false;
  }).length;
  const inProgressProjects = projects.filter(p => {
    const s = (p.status || '').toLowerCase();
    return s.includes('progress') || s.includes('doing') || s.includes('development') || s.includes('testing');
  }).length;
  const planningProjects = projects.filter(p => {
    const s = (p.status || '').toLowerCase();
    return s.includes('plan') || s.includes('review');
  }).length;
  const holdProjects = projects.filter(p => (p.status || '').toLowerCase().includes('hold')).length;

  let sy = contentStartY + 5;

  // Header Block
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 41, 59);
  const summaryTitle = (!department || department === 'All') ? 'Overall Performance Summary' : 'Department Performance Summary';
  pdf.text(summaryTitle, marginL, sy);
  sy += 5;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  const deptLabel = (!department || department === 'All') ? 'All Departments' : `Department: ${department}`;
  pdf.text(
    `${deptLabel}  |  Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    marginL, sy
  );
  sy += 3;

  // Divider
  pdf.setDrawColor(99, 102, 241);
  pdf.setLineWidth(1.2);
  pdf.line(marginL, sy, pageW - marginR, sy);
  sy += 7;

  // KPI TILES
  const kpiItems = [
    { label: 'Total Projects', value: totalProjects, r: 99, g: 102, b: 241 },
    { label: 'Done', value: doneProjects, r: 16, g: 185, b: 129 },
    { label: 'In Progress', value: inProgressProjects, r: 59, g: 130, b: 246 },
    { label: 'Planning', value: planningProjects, r: 124, g: 58, b: 237 },
    { label: 'Hold', value: holdProjects, r: 245, g: 158, b: 11 },
    { label: 'Overdue', value: overdueProjects, r: 239, g: 68, b: 68 },
    { label: 'Cancelled', value: cancelledProjects, r: 148, g: 163, b: 184 },
  ];
  const tileGap = 3;
  const tileW = (contentW - tileGap * (kpiItems.length - 1)) / kpiItems.length;
  const tileH = 20;
  kpiItems.forEach((k, i) => {
    const tx = marginL + i * (tileW + tileGap);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(tx, sy, tileW, tileH, 2, 2, 'F');
    pdf.setFillColor(k.r, k.g, k.b);
    pdf.roundedRect(tx, sy, tileW, 2.5, 1, 1, 'F');
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(k.r, k.g, k.b);
    pdf.text(k.value.toString(), tx + tileW / 2, sy + 13, { align: 'center' });
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(k.label, tx + tileW / 2, sy + tileH - 2.5, { align: 'center' });
  });
  sy += tileH + 12; // Extra space before the table

  // =============================================
  // Table: Project List
  // =============================================

  const tableRows: any[] = [];
  
  projects.forEach((p, idx) => {
    const statusStr = (p.status || '-').trim();
    const sLow = statusStr.toLowerCase();
    const isDoneStatus = sLow.includes('done') || sLow.includes('complete') || sLow.includes('cancel');
    const isOverdue = isProjectOverdue(statusStr, p.end_date);

    const cleanName = (p.project_name || '-').substring(0, 50);

    // Map Manager ID to Name
    let managerName = p.manager_id || '-';
    if (managerName !== '-') {
      const u = users.find(user => user.id === managerName || user.email === managerName);
      if (u) {
        let fullName = u.name_en || u.name_th || u.email || managerName;
        const parts = fullName.trim().split(/\s+/);
        if (parts.length >= 2 && !fullName.includes('@')) {
          managerName = `${parts[0]} ${parts[1].substring(0, 2)}.`;
        } else if (fullName.includes('@')) {
          managerName = fullName.split('@')[0];
        } else {
          managerName = parts[0];
        }
      }
    }

    tableRows.push([
      (idx + 1).toString(),
      p.project_code || '-',
      cleanName,
      p.client_name || '-',
      managerName,
      p.start_date ? formatDateYYYYMMDD(new Date(p.start_date)) : '-',
      p.end_date ? formatDateYYYYMMDD(new Date(p.end_date)) : '-',
      isOverdue ? `${statusStr}*` : statusStr,
    ]);
  });

  autoTable(pdf, {
    head: [['#', 'Project Code', 'Project Name', 'Client', 'Manager', 'Start', 'Target', 'Status']],
    body: tableRows,
    startY: sy,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }, lineColor: [226, 232, 240], lineWidth: 0.2, textColor: [51, 65, 85], font: 'helvetica' },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: HEADER_H + 6, left: marginL, right: marginR, bottom: FOOTER_H + 4 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 25 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 35 },
      4: { cellWidth: 30 },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
      7: { cellWidth: 25, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'head') return;
      if (data.column.index === 7) {
        const text = data.cell.text[0] || '';
        const tl = text.toLowerCase();
        if (text.includes('*') || tl.includes('overdue')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (tl.includes('done') || tl.includes('complete')) {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else if (tl.includes('progress') || tl.includes('doing') || tl.includes('dev')) {
          data.cell.styles.textColor = [37, 99, 235];
        } else if (tl.includes('plan') || tl.includes('review')) {
          data.cell.styles.textColor = [109, 40, 217];
        } else if (tl.includes('hold')) {
          data.cell.styles.textColor = [180, 120, 0];
        } else if (tl.includes('cancel')) {
          data.cell.styles.textColor = [100, 116, 139];
        }
      }
    },
    didDrawPage: (data) => {
      // Header/footer will be drawn at the end for all pages
    },
  });

  const totalPages = (pdf.internal as any).getNumberOfPages();
  const pageSubtitles: { [k: number]: string } = {};

  for (let i = 1; i <= totalPages; i++) {
    const subtitleText = (!department || department === 'All') ? 'Overall Performance Summary & Details' : 'Department Performance Summary & Details';
    pageSubtitles[i] = subtitleText;
  }

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    drawHeaderFooter(pdf, i, totalPages, pageSubtitles[i]);
  }

  const deptSafe = (department || 'All').replace(/[^a-zA-Z0-9]/g, '_');
  pdf.save(`DeptReport_${deptSafe}_${getUDTString()}.pdf`);
};

import { jsPDF } from 'jspdf';
import { ProjectData } from '@/interfaces';
import { formatDateDDMMYYYY } from '@/utils/date';

export const PDF_LAYOUT = {
  marginL: 14,
  marginR: 14,
  headerH: 22,
  footerH: 14,
  contentStartY: 22 + 4, // headerH + 4
};

export const getProjectDurationStrings = (project: ProjectData) => {
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
  return { projectDuration, projectDurationLong };
};

export const drawHeaderFooter = (
  pdf: jsPDF,
  pageNum: number,
  totalPages: number,
  subtitle: string,
  title: string,
  exporterName: string,
  projectDuration: string,
  footerText: string
) => {
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const { marginL, marginR, headerH, footerH } = PDF_LAYOUT;

  // Header background
  pdf.setFillColor(30, 41, 59); // slate-800
  pdf.rect(0, 0, W, headerH, 'F');

  // Accent stripe
  pdf.setFillColor(99, 102, 241); // indigo-500
  pdf.rect(0, headerH - 2, W, 2, 'F');

  // Title
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title || 'Report', marginL, 9);

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

  // Footer background to clear previous draws
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, H - footerH - 1, W, footerH + 1, 'F');

  // Footer line
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.3);
  pdf.line(marginL, H - footerH, W - marginR, H - footerH);
  pdf.setFontSize(6.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text(footerText || '', marginL, H - footerH + 5);
  pdf.text(`Page ${pageNum}${totalPages ? ` of ${totalPages}` : ''}`, W - marginR, H - footerH + 5, { align: 'right' });
};

import {
  isDoneStatus,
  isProgressStatus,
  isReviewStatus,
  isHoldStatus,
  isCancelStatus
} from '@/constants/status';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const PDF_COLORS = {
  primary: { r: 99, g: 102, b: 241 }, // indigo-500
  success: { r: 16, g: 185, b: 129 }, // emerald-500
  info: { r: 59, g: 130, b: 246 }, // blue-500
  warning: { r: 245, g: 158, b: 11 }, // amber-500
  danger: { r: 239, g: 68, b: 68 }, // red-500
  review: { r: 124, g: 58, b: 237 }, // violet-600
  neutral: { r: 148, g: 163, b: 184 }, // slate-400
  textMain: { r: 30, g: 41, b: 59 }, // slate-800
  textMuted: { r: 100, g: 116, b: 139 }, // slate-500
  bgLight: { r: 248, g: 250, b: 252 }, // slate-50
  borderLight: { r: 226, g: 232, b: 240 }, // slate-200
};

export const getStatusPdfColor = (statusStr: string, isOverdue: boolean = false): RGB => {
  if (isOverdue && !isHoldStatus(statusStr) && !isDoneStatus(statusStr) && !isCancelStatus(statusStr)) {
    return PDF_COLORS.danger;
  }
  if (isDoneStatus(statusStr)) return PDF_COLORS.success;
  if (isProgressStatus(statusStr)) return PDF_COLORS.info;
  if (isReviewStatus(statusStr)) return PDF_COLORS.review;
  if (isHoldStatus(statusStr)) return PDF_COLORS.warning;
  if (isCancelStatus(statusStr)) return PDF_COLORS.neutral;

  // Fallback for "To Do" or empty
  return PDF_COLORS.primary;
};

export const getStatusPdfTextColorArray = (statusStr: string, isOverdue: boolean = false): [number, number, number] => {
  const { r, g, b } = getStatusPdfColor(statusStr, isOverdue);
  return [r, g, b];
};

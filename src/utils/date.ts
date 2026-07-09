/**
 * date.ts
 * Standard date utility functions for IT Plan Tracker
 */

/**
 * Safely parses a date string or Date object into a valid Date object.
 * Supports multiple formats including ISO, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD.
 * @param dateStr The date to parse
 * @returns Date object if valid, or null if invalid
 */
export const parseSafeDate = (dateStr: string | Date | undefined | null): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;

  const str = String(dateStr).trim();

  // Try DD/MM/YYYY or DD-MM-YYYY (Thai standard)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const part1 = parseInt(dmyMatch[1], 10);
    const part2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    let day = part1;
    let month = part2 - 1; // 0-indexed

    // If part2 > 12, it's impossible to be DD/MM/YYYY, it must be MM/DD/YYYY
    if (part2 > 12) {
      month = part1 - 1;
      day = part2;
    }

    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback to standard JS parsing (handles YYYY-MM-DD from input type="date")
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
};

/**
 * Formats a Date object or date string into DD/MM/YYYY
 */
export const formatDateDDMMYYYY = (dateVal: string | Date | undefined | null): string => {
  const parsedDate = parseSafeDate(dateVal);
  if (!parsedDate) return '';
  const day = String(parsedDate.getDate()).padStart(2, '0');
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const year = parsedDate.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Formats a Date object or date string into YYYY-MM-DD (Standard for HTML inputs)
 */
export const formatDateYYYYMMDD = (dateVal: string | Date | undefined | null): string => {
  const parsedDate = parseSafeDate(dateVal);
  if (!parsedDate) return '';
  const day = String(parsedDate.getDate()).padStart(2, '0');
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const year = parsedDate.getFullYear();
  return `${year}-${month}-${day}`;
};

/**
 * Check if a date is overdue compared to today
 */
export const isDateOverdue = (dateVal: string | Date | undefined | null): boolean => {
  const parsedDate = parseSafeDate(dateVal);
  if (!parsedDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsedDate.setHours(0, 0, 0, 0);

  return parsedDate < today;
};

/**
 * Helper to get an effective start date from any object with a start_date
 */
export const getEffectiveStartDate = (item: { start_date?: string | null }): Date | null => {
  return parseSafeDate(item.start_date);
};

/**
 * Helper to get an effective end date from any object with update_date or due_date
 * Prioritizes update_date (actual update), then falls back to due_date (planned deadline)
 */
export const getEffectiveEndDate = (item: { update_date?: string | null; due_date?: string | null }): Date | null => {
  return parseSafeDate(item.update_date || item.due_date);
};

/**
 * Generates a human-readable due date label and danger flag
 */
export const getDueLabel = (dateStr: string, status: string): { label: string; danger: boolean } => {
  const s = (status || '').toLowerCase();
  if (s.includes('cancel') || s.includes('done') || s.includes('complete')) {
    return { label: formatDateDDMMYYYY(dateStr) || '-', danger: false };
  }

  const parsedDate = parseSafeDate(dateStr);
  if (!parsedDate) return { label: '-', danger: false };

  const today = new Date(); 
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); 
  tomorrow.setDate(today.getDate() + 1);
  const diff = Math.ceil((parsedDate.getTime() - today.getTime()) / 86400000);

  if (+parsedDate === +today) return { label: 'Today', danger: true };
  if (+parsedDate === +tomorrow) return { label: 'Tomorrow', danger: true };
  if (parsedDate < today) return { label: 'Overdue', danger: true };
  if (diff <= 7) return { label: `${diff}d left`, danger: false };
  
  return { label: formatDateDDMMYYYY(dateStr), danger: false };
};

/**
 * Normalizes start and end dates for the Gantt chart.
 * Ensures dates are valid, end >= start, and sets proper hours (00:00:00 to 23:59:59).
 */
export const normalizeGanttDates = (item: { start_date?: string | null, due_date?: string | null, update_date?: string | null }): { startDate: Date, endDate: Date } => {
  let startDate = new Date();
  let endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);

  const parsedStart = getEffectiveStartDate(item);
  if (parsedStart) startDate = parsedStart;

  const parsedEnd = getEffectiveEndDate(item);
  if (parsedEnd) endDate = parsedEnd;

  if (startDate > endDate) {
    endDate = new Date(startDate);
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
};

/**
 * Generates a UDT string for file exports, e.g. _ UDTYYYYMMDD_HHMM
 */
export const getUDTString = (): string => {
  const now = new Date();
  const d = now.getFullYear().toString() + 
            String(now.getMonth() + 1).padStart(2, '0') + 
            String(now.getDate()).padStart(2, '0');
  const t = String(now.getHours()).padStart(2, '0') + 
            String(now.getMinutes()).padStart(2, '0');
  return `_ UDT${d}_${t}`;
};

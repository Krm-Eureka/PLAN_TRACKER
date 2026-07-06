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
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed month
    const year = parseInt(dmyMatch[3], 10);
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
  const d = parseSafeDate(dateVal);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Formats a Date object or date string into YYYY-MM-DD (Standard for HTML inputs)
 */
export const formatDateYYYYMMDD = (dateVal: string | Date | undefined | null): string => {
  const d = parseSafeDate(dateVal);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

/**
 * Check if a date is overdue compared to today
 */
export const isDateOverdue = (dateVal: string | Date | undefined | null): boolean => {
  const d = parseSafeDate(dateVal);
  if (!d) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  
  return d < today;
};

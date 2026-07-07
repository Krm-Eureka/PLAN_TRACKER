import axios from 'axios';

type AxiosError = { response?: { data?: { error?: { message?: string } } }; message?: string };

// ---------------------------------------------------------------------------
// Simple in-memory cache to avoid exceeding Google Sheets read quota
// (60 read requests per minute per user)
// ---------------------------------------------------------------------------
interface CacheEntry {
  data: Record<string, string>[];
  expiresAt: number;
}
const sheetsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 500; // Disable in-memory cache to prevent stale data across workers (Next.js serverless architecture)

function getCacheKey(token: string, range: string): string {
  // Use last 8 chars of token (safe) + range as key
  return `${token.slice(-8)}::${range}`;
}

export function invalidateSheetsCache(range?: string) {
  // Always clear the entire cache on any mutation to prevent stale-data bugs across different sheets.
  // The TTL is short (60s), so this is safe and guarantees users always see fresh data after an edit.
  sheetsCache.clear();
}
// ---------------------------------------------------------------------------

/**
 * Fetch rows from a sheet range, returns as array of objects keyed by header.
 * Results are cached for 60 seconds to reduce API quota usage.
 */
export async function fetchSheetData(accessToken: string, range: string): Promise<Record<string, string>[]> {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");
  }

  // Check cache first
  const cacheKey = getCacheKey(accessToken, range);
  const cached = sheetsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;

  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      sheetsCache.set(cacheKey, { data: [], expiresAt: Date.now() + CACHE_TTL_MS });
      return [];
    }

    const headers: string[] = rows[0];

    const result = rows.slice(1).map((row: string[]) => {
      const obj: Record<string, string> = {};

      // Map all standard headers
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] ?? "";
      });

      // If there are extra data columns beyond the declared headers,
      // try to match them to known field names in the order they are
      // most commonly appended, then fall back to generic col_N names.
      if (row.length > headers.length) {
        // Priority list: field names that may be appended to sheets without a header yet.
        const knownFallbacks = [
          'plan_detail',       // Plans sheet col G (index 6)
          'task_id',           // Plans sheet col H (index 7)
          'start_time',        // Plans sheet col I (index 8)
          'end_time',          // Plans sheet col J (index 9)
          'color',             // Projects sheet extra
          'task_order',        // Tasks Gantt hierarchy
          'parent_task_id',    // Tasks Gantt hierarchy
          'percent_complete',  // Tasks Gantt progress
          'position',          // Users sheet extra
        ];

        // Build a set of fields already covered by the header row
        const coveredFields = new Set(headers);

        // Assign remaining fallbacks in order to extra columns
        const unusedFallbacks = knownFallbacks.filter(f => !coveredFields.has(f));
        let fallbackIdx = 0;

        for (let i = headers.length; i < row.length; i++) {
          if (fallbackIdx < unusedFallbacks.length) {
            obj[unusedFallbacks[fallbackIdx]] = row[i];
            fallbackIdx++;
          } else {
            obj[`col_${i}`] = row[i];
          }
        }
      }

      return obj;
    });

    // Store in cache
    sheetsCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to fetch from Google Sheets API");
  }
}

/**
 * Get column letter from zero-based index (0 -> A, 25 -> Z, 26 -> AA)
 */
export function getColumnLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode(65 + (temp % 26)) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Fetch headers (first row) of a sheet.
 */
export async function getSheetHeaders(accessToken: string, sheetName: string): Promise<string[]> {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName + '!A1:ZZ1')}`;

  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return (res.data.values && res.data.values[0]) ? res.data.values[0] : [];
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to fetch headers from Google Sheets API");
  }
}

/**
 * Append a single row to a sheet.
 */
export async function appendSheetRow(accessToken: string, range: string, values: (string | number)[]) {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`;

  try {
    const res = await axios.post(url, { values: [values] }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    invalidateSheetsCache();
    return res.data;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to append to Google Sheets API");
  }
}

/**
 * Append multiple rows to a sheet.
 */
export async function appendSheetRows(accessToken: string, range: string, values: (string | number)[][]) {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`;

  try {
    const res = await axios.post(url, { values }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    invalidateSheetsCache();
    return res.data;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to append multiple rows to Google Sheets API");
  }
}

/**
 * Update a single cell value.
 */
export async function updateSheetCell(accessToken: string, range: string, value: string) {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

  try {
    const res = await axios.put(url, { values: [[value]] }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    invalidateSheetsCache();
    return res.data;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to update Google Sheets API");
  }
}

/**
 * Delete a specific row by index (1-indexed, e.g. row 2)
 */
export async function deleteSheetRow(accessToken: string, sheetName: string, rowIndex: number) {
  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");

  // 1. First, we need to get the sheetId (gid) for the given sheetName
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  let sheetId: number | undefined;

  try {
    const metaRes = await axios.get(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const sheets = metaRes.data.sheets || [];
    const sheet = sheets.find((s: any) => s.properties.title === sheetName);
    if (!sheet) throw new Error(`Sheet ${sheetName} not found`);
    sheetId = sheet.properties.sheetId;
  } catch (error: any) {
    throw new Error("Failed to fetch spreadsheet metadata: " + error.message);
  }

  // 2. Perform batchUpdate to delete the row
  const deleteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const request = {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: "ROWS",
            startIndex: rowIndex - 1, // 0-indexed, inclusive
            endIndex: rowIndex,       // 0-indexed, exclusive
          }
        }
      }
    ]
  };

  try {
    const res = await axios.post(deleteUrl, request, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    invalidateSheetsCache();
    return res.data;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to delete row from Google Sheets API");
  }
}

/**
 * Update multiple cells in a row
 */
export async function updateSheetRow(accessToken: string, range: string, values: any[]) {
  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  try {
    const res = await axios.put(url, { values: [values] }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    invalidateSheetsCache();
    return res.data;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to update row in Google Sheets API");
  }
}

/**
 * Creates a new sheet in the spreadsheet
 */
export async function createSheet(accessToken: string, sheetTitle: string) {
  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const request = {
    requests: [
      {
        addSheet: {
          properties: {
            title: sheetTitle
          }
        }
      }
    ]
  };

  try {
    const res = await axios.post(url, request, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    invalidateSheetsCache();
    return res.data;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to create sheet in Google Sheets API");
  }
}

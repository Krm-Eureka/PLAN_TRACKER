import axios from 'axios';

type AxiosError = { response?: { data?: { error?: { message?: string } } }; message?: string };

/**
 * Fetch rows from a sheet range, returns as array of objects keyed by header.
 */
export async function fetchSheetData(accessToken: string, range: string): Promise<Record<string, string>[]> {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");
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
    if (rows.length === 0) return [];

    const headers = rows[0] as string[];
    return rows.slice(1).map((row: string[]) => {
      const obj: Record<string, string> = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] ?? "";
      });
      return obj;
    });
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

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  try {
    const res = await axios.post(url, { values: [values] }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
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

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  try {
    const res = await axios.post(url, { values }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
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

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  try {
    const res = await axios.put(url, { values: [[value]] }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
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
    return res.data;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to update row in Google Sheets API");
  }
}

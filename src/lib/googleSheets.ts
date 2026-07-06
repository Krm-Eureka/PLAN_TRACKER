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

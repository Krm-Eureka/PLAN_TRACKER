import axios from 'axios';

type AxiosError = { response?: { data?: { error?: { message?: string } } }; message?: string };

export async function fetchSheetData(accessToken: string, range: string) {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;
  
  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const rows = res.data.values || [];
    if (rows.length === 0) return [];

    // Convert array of arrays to array of objects
    const headers = rows[0] as string[];
    const result = rows.slice(1).map((row: string[]) => {
      const obj: Record<string, string> = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || "";
      });
      return obj;
    });

    return result;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to fetch from Google Sheets API");
  }
}

export async function appendSheetRow(accessToken: string, range: string, values: string[]) {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
  
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

export async function appendSheetRows(accessToken: string, range: string, values: string[][]) {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
  
  try {
    const res = await axios.post(url, { values: values }, {
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

export async function updateSheetCell(accessToken: string, range: string, value: string) {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  
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

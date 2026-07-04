import axios from 'axios';

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
    const headers = rows[0];
    const result = rows.slice(1).map((row: any[]) => {
      let obj: Record<string, any> = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || "";
      });
      return obj;
    });

    return result;
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message || "Failed to fetch from Google Sheets API");
  }
}

export async function appendSheetRow(accessToken: string, range: string, values: any[]) {
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
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message || "Failed to append to Google Sheets API");
  }
}

export async function appendSheetRows(accessToken: string, range: string, values: any[][]) {
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
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message || "Failed to append multiple rows to Google Sheets API");
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
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message || "Failed to update Google Sheets API");
  }
}

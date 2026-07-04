export async function fetchSheetData(accessToken: string, range: string) {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;
  
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store' // Always fetch fresh data to avoid stale UI after updates
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || "Failed to fetch from Google Sheets API");
  }

  const data = await res.json();
  const rows = data.values || [];

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
}

export async function appendSheetRow(accessToken: string, range: string, values: any[]) {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [values]
    })
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || "Failed to append to Google Sheets API");
  }

  return await res.json();
}

export async function updateSheetCell(accessToken: string, range: string, value: string) {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [[value]]
    })
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || "Failed to update Google Sheets API");
  }

  return await res.json();
}

import axios from 'axios';

type AxiosError = { response?: { data?: { error?: { message?: string } } }; message?: string };

// ---------------------------------------------------------------------------
// Google Sheets API configuration
// ---------------------------------------------------------------------------
const getBaseUrl = () => {
  const sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("NEXT_PUBLIC_GOOGLE_SHEET_ID is not configured in .env.local");
  return `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
};
// ---------------------------------------------------------------------------

export async function fetchSheetData(accessToken: string, range: string): Promise<Record<string, string>[]> {
  const url = `${getBaseUrl()}/values/${encodeURIComponent(range)}`;

  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      return [];
    }

    const headers: string[] = rows[0];

    const result = rows.slice(1).map((row: string[], idx: number) => {
      const obj: Record<string, any> = {};

      // Map all standard headers
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] ?? "";
      });

      // Inject the actual 1-based row index (Header is row 1, data starts at row 2)
      obj['_rowIndex'] = idx + 2;

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
  const url = `${getBaseUrl()}/values/${encodeURIComponent(sheetName + '!A1:ZZ1')}`;

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
  const url = `${getBaseUrl()}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`;

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
  const url = `${getBaseUrl()}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`;

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
  const url = `${getBaseUrl()}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

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
  // 1. First, we need to get the sheetId (gid) for the given sheetName
  const metaUrl = getBaseUrl();
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
  const deleteUrl = `${getBaseUrl()}:batchUpdate`;
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
 * Delete multiple rows by their indices (1-indexed, e.g., [2, 5, 8])
 */
export async function deleteSheetRows(accessToken: string, sheetName: string, rowIndices: number[]) {
  if (rowIndices.length === 0) return { status: 'skipped' };

  const metaUrl = getBaseUrl();
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

  // Sort descending so deleting higher indices doesn't shift lower indices!
  const sortedIndices = [...rowIndices].sort((a, b) => b - a);

  const deleteUrl = `${getBaseUrl()}:batchUpdate`;
  const requests = sortedIndices.map(rowIndex => ({
    deleteDimension: {
      range: {
        sheetId: sheetId,
        dimension: "ROWS",
        startIndex: rowIndex - 1, // 0-indexed, inclusive
        endIndex: rowIndex,       // 0-indexed, exclusive
      }
    }
  }));

  try {
    const res = await axios.post(deleteUrl, { requests }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return res.data;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to delete rows from Google Sheets API");
  }
}

/**
 * Update multiple cells in a row
 */
export async function updateSheetRow(accessToken: string, range: string, values: any[]) {
  const url = `${getBaseUrl()}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

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

/**
 * Batch update multiple ranges and values in a single API call
 */
export async function batchUpdateSheetValues(accessToken: string, data: { range: string, values: any[][] }[]) {
  const url = `${getBaseUrl()}/values:batchUpdate`;

  try {
    const res = await axios.post(url, {
      valueInputOption: "USER_ENTERED",
      data: data
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return res.data;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to batch update values in Google Sheets API");
  }
}

/**
 * Creates a new sheet in the spreadsheet
 */
export async function createSheet(accessToken: string, sheetTitle: string) {
  const url = `${getBaseUrl()}:batchUpdate`;
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
    return res.data;
  } catch (error: unknown) {
    const err = error as AxiosError;
    throw new Error(err.response?.data?.error?.message || err.message || "Failed to create sheet in Google Sheets API");
  }
}

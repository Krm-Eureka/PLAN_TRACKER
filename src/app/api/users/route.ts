import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { fetchSheetData } from '@/lib/googleSheets';

export async function GET() {
  try {
    // 1. Verify User Session for security
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    // 2. Extract the Google Access Token to act on behalf of the user
    const accessToken = (session as { accessToken?: string })?.accessToken;
    if (!accessToken) {
       return NextResponse.json({ status: 'error', message: 'No Google Access Token found' }, { status: 401 });
    }

    // 3. Fetch data directly from Google Sheets API
    const users = await fetchSheetData(accessToken, 'Users!A1:N');
    
    return NextResponse.json({ status: 'success', data: users });
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Backend API Error (Users):", err);
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}

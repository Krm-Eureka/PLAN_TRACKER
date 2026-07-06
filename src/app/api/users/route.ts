import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { fetchSheetData } from '@/lib/googleSheets';
import { getSessionContext } from '@/lib/permissions';

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
    
    // 4. Filter users by department (Admins see everyone, others see only their department)
    const ctx = await getSessionContext();
    let filteredUsers = users;
    
    if (ctx && !ctx.isAdmin && ctx.department) {
      const myDept = ctx.department.toLowerCase();
      filteredUsers = users.filter((u: Record<string, string>) => 
        (u.department || "").toLowerCase() === myDept
      );
    }
    
    return NextResponse.json({ status: 'success', data: filteredUsers });
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Backend API Error (Users):", err);
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { createSheet, updateSheetRow } from '@/lib/googleSheets';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = (session as { accessToken?: string })?.accessToken;
    if (!accessToken) {
       return NextResponse.json({ status: 'error', message: 'No Google Access Token found' }, { status: 401 });
    }

    // 1. Create the Notifications sheet
    try {
      await createSheet(accessToken, 'Notifications');
    } catch (e: any) {
      // It might already exist, which is fine
      console.log('Sheet might already exist or failed to create:', e.message);
    }

    // 2. Set headers
    await updateSheetRow(accessToken, 'Notifications!A1:G1', [
      'id', 'user_id', 'title', 'message', 'link', 'is_read', 'created_at'
    ]);

    return NextResponse.json({ status: 'success', message: 'Successfully created Notifications sheet and headers!' });
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Backend API Error (Migrate Notifications):", err);
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}

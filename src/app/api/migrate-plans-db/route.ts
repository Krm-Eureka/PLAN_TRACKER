import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { updateSheetRow } from '@/lib/googleSheets';

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

    // Update headers in Plans sheet: G1 = plan_detail, H1 = task_id
    await updateSheetRow(accessToken, 'Plans!G1:H1', ['plan_detail', 'task_id']);

    return NextResponse.json({ status: 'success', message: 'Successfully updated Plans headers (plan_detail, task_id) in Google Sheets!' });
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Backend API Error (Migrate):", err);
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}

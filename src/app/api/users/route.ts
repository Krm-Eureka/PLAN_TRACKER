import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';

const API_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

export async function GET() {
  try {
    // 1. Verify User Session for security
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    // 2. Extract the Google Access Token to act on behalf of the user
    const accessToken = (session as any)?.accessToken;
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // 3. Fetch data from Google Apps Script (Database)
    let res = await fetch(`${API_URL}?action=getUsers`, { 
      next: { revalidate: 60 }, // ISR Cache 60s
      headers,
      redirect: 'manual' 
    });

    // Handle Google Apps Script cross-domain redirect (302)
    if (res.status === 302 || res.status === 301 || res.status === 303 || res.status === 307) {
      const redirectUrl = res.headers.get('location');
      if (redirectUrl) {
        res = await fetch(redirectUrl, {
          next: { revalidate: 60 },
          headers, // Re-attach the Authorization header
        });
      }
    }

    const result = await res.json();
    
    if (result.status === 'success') {
      return NextResponse.json({ status: 'success', data: result.data });
    }
    
    return NextResponse.json({ status: 'error', message: result.message }, { status: 500 });
  } catch (error: any) {
    console.error("Backend API Error (Users):", error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

// @ts-nocheck
import { NextResponse } from 'next/server';
import { getSessionContext } from "@/lib/permissions";
import { authOptions } from '../auth/[...nextauth]/route';

const API_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = session?.token;
    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let res = await fetch(`${API_URL}?action=getGroupMembersList`, { 
      next: { revalidate: 0 }, // no cache for this test route
      headers,
      redirect: 'manual' 
    });

    if (res.status === 302 || res.status === 301 || res.status === 303 || res.status === 307) {
      const redirectUrl = res.headers.get('location');
      if (redirectUrl) {
        res = await fetch(redirectUrl, {
          next: { revalidate: 0 },
          headers,
        });
      }
    }

    const result = await res.json();
    
    if (result.status === 'success') {
      return NextResponse.json({ status: 'success', data: result.data });
    }
    
    return NextResponse.json({ status: 'error', message: result.message }, { status: 500 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Backend API Error (Groups):", err);
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}

import { safeErrorMessage } from "@/lib/apiError";
import { NextResponse } from 'next/server';
import axios from "axios";
import { getSessionContext } from "@/lib/permissions";

const API_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = session?.token;
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let res = await axios.get(`${API_URL}?action=getGroupMembersList`, {
      headers,
      maxRedirects: 0,
      timeout: 10_000,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    if (res.status === 302 || res.status === 301 || res.status === 303 || res.status === 307) {
      const redirectUrl = res.headers?.location;
      if (redirectUrl) {
        res = await axios.get(redirectUrl, {
          headers,
          timeout: 10_000,
          validateStatus: (status) => status >= 200 && status < 400,
        });
      }
    }

    const result = res.data;
    
    if (result.status === 'success') {
      return NextResponse.json({ status: 'success', data: result.data });
    }
    
    return NextResponse.json({ status: 'error', message: result.message }, { status: 500 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Backend API Error (Groups):", err);
    return NextResponse.json({ status: 'error', message: safeErrorMessage(err) }, { status: 500 });
  }
}

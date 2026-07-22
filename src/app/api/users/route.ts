// @ts-nocheck
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. Verify User Session for security
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch data directly from Prisma Database
    const users = await prisma.user.findMany({
      orderBy: { created_at: 'desc' }
    });
    
    return NextResponse.json({ status: 'success', data: users });
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Backend API Error (Users):", err);
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}

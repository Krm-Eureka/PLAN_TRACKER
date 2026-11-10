'use client';

import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  // mock session ฝั่ง UI เท่านั้น (server ใช้ IS_TEST_MODE) และปิดเสมอใน production build
  const isPlaywright = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === '1';
  const mockSession = isPlaywright ? {
    user: { name: 'Test Admin', email: 'admin@test.com', id: 'test-admin-id', role: 'admin' },
    expires: '9999-12-31T23:59:59.999Z',
  } : undefined;

  return <SessionProvider session={mockSession as any}>{children}</SessionProvider>;
}

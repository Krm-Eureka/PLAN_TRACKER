'use client';

import { useState, useEffect } from 'react';
import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Socket setup for real-time updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Connect to the separate Socket.io server dynamically using the host's IP/domain
    const socketUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
    const socket: Socket = io(socketUrl);

    socket.on('connect', () => {
      console.log('Connected to real-time server');
    });

    socket.on('data-updated', (data) => {
      console.log('Real-time update received:', data);
      // Refresh current route to fetch new data from server components
      router.refresh();
    });

    return () => {
      socket.disconnect();
    };
  }, [router]);

  // Close mobile menu on route change
  // Note: we can use useEffect, but to avoid synchronous setState warning:
  useEffect(() => {
    // A small timeout avoids synchronous update warnings during React render phase
    const timeoutId = setTimeout(() => {
      setIsMobileMenuOpen(false);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900 relative">
      {/* Mobile sidebar backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar for mobile and desktop */}
      <div className={cn(
        "flex-shrink-0 transition-all duration-300 ease-in-out",
        "fixed inset-y-0 left-0 z-50 lg:static lg:z-auto",
        isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0",
        isCollapsed ? "lg:w-20" : "lg:w-64"
      )}>
        <Sidebar isCollapsed={isCollapsed} toggleCollapse={() => setIsMobileMenuOpen(false)} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out relative">
        <Header 
          toggleCollapse={() => setIsMobileMenuOpen(true)} 
          isCollapsed={isCollapsed}
          toggleDesktopCollapse={() => setIsCollapsed(!isCollapsed)}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50/50 relative">
          {/* Subtle background decoration */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-40"></div>

          <div className="w-full px-4 py-4 sm:px-3 md:py-5 lg:px-4 relative">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

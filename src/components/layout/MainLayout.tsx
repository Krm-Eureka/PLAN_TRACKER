'use client';

import { useState } from 'react';
import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Static sidebar for desktop */}
      <div className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-40 transition-all duration-300 ease-in-out",
        isCollapsed ? "lg:w-20" : "lg:w-64"
      )}>
        <Sidebar isCollapsed={isCollapsed} toggleCollapse={() => setIsCollapsed(!isCollapsed)} />
      </div>

      <div className={cn(
        "flex flex-col flex-1 w-full relative transition-all duration-300 ease-in-out",
        isCollapsed ? "lg:pl-20" : "lg:pl-64"
      )}>
        <Header />
        
        <main className="flex-1 overflow-y-auto bg-slate-50/50 relative">
          {/* Subtle background decoration */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-40"></div>
          
          <div className="w-full px-4 py-8 sm:px-6 md:py-10 lg:px-8 relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

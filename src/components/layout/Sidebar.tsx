'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CheckSquare,
  ListTodo,
  Calendar,
  Settings,
  ShieldAlert,
  ChevronRight,
  X,
  PieChart,
  Kanban,
  FolderKanban
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tasks & Workspace', href: '/tasks', icon: ListTodo },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Reports', href: '/reports', icon: PieChart, managerOnly: true },
];

export function Sidebar({ isCollapsed = false, toggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  const roleSystem = ((session as any)?.role_system || '').toLowerCase();
  const isAdmin = roleSystem === 'admin';
  const isManagerOrHigher = isAdmin || 
    roleSystem.includes("manager") || 
    roleSystem.includes("md") || 
    roleSystem.includes("director") ||
    roleSystem.includes("supervisor");

  return (
    <div className={cn(
      "flex h-full flex-col bg-slate-900/95 backdrop-blur-md border-r border-slate-800 text-slate-300 transition-[width] duration-200 ease-out",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className={cn(
        "flex h-16 items-center border-b border-slate-800/50",
        isCollapsed ? "justify-center px-0" : "px-5 justify-between"
      )}>
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0 flex items-center justify-center">
            <img
              src="/IT.webp"
              alt="IT"
              className="h-10 w-auto object-contain rounded-md"
            />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold text-white tracking-wide transition-opacity duration-300">Tracker</span>
          )}
        </div>
        {toggleCollapse && !isCollapsed && (
          <Button variant="ghost" size="icon" onClick={toggleCollapse} className="lg:hidden text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {!isCollapsed && (
          <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Menu
          </div>
        )}



        {navigation.map((item) => {
          if (item.managerOnly && !isManagerOrHigher) return null;

          // Find the most specific match for the current pathname
          const activeHref = navigation.reduce((bestMatch, navItem) => {
            if (pathname === navItem.href || pathname.startsWith(`${navItem.href}/`)) {
              if (navItem.href.length > bestMatch.length) {
                return navItem.href;
              }
            }
            return bestMatch;
          }, '');

          const isActive = item.href === activeHref;

          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={cn(
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'hover:bg-slate-800/60 text-slate-400 hover:text-white',
                'group flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors duration-200 ease-out',
                isCollapsed ? 'justify-center px-0' : 'px-3 mx-2'
              )}
            >
              <item.icon
                className={cn(
                  isActive ? 'text-white drop-shadow-sm' : 'text-slate-400 group-hover:text-white',
                  'h-5 w-5 flex-shrink-0 transition-colors',
                  !isCollapsed && 'mr-3'
                )}
                aria-hidden="true"
              />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <Link
          href="/settings"
          title={isCollapsed ? "Settings" : undefined}
          className={cn(
            pathname === '/settings'
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25'
              : 'hover:bg-slate-800/60 text-slate-400 hover:text-white',
            "group flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
            isCollapsed ? "justify-center px-0" : "px-3 mx-2"
          )}
        >
          <Settings className={cn(pathname === '/settings' ? 'text-white drop-shadow-sm' : 'text-slate-400 group-hover:text-white', "h-5 w-5", !isCollapsed && "mr-3")} />
          {!isCollapsed && <span>Settings</span>}
        </Link>
      </div>
    </div>
  );
}

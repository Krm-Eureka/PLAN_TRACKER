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
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'My Tasks', href: '/tasks/me', icon: CheckSquare },
  { name: 'All Tasks', href: '/tasks', icon: ListTodo },
  { name: 'Projects', href: '/projects', icon: ShieldAlert },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
];

export function Sidebar({ isCollapsed = false, toggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className={cn(
      "flex h-full flex-col bg-slate-900/95 backdrop-blur-md border-r border-slate-800 text-slate-300 transition-all duration-300",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className={cn(
        "flex h-16 items-center border-b border-slate-800",
        isCollapsed ? "justify-center px-0" : "px-6 justify-between"
      )}>
        <div className="flex items-center gap-2">
          <div className="w-fit h-fit flex-shrink-0 rounded flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
            <img
              src="/IT.webp"
              alt="IT"
              className="w-24 h-12 object-full object-cover rounded-lg"
            />          </div>
          {!isCollapsed && (
            <span className="text-lg font-semibold text-white tracking-wide transition-opacity duration-300">Tracker</span>
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

        {isCollapsed && toggleCollapse && (
          <div className="flex justify-center mb-4">
            <Button variant="ghost" size="icon" onClick={toggleCollapse} className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {navigation.map((item) => {
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
                  ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'hover:bg-slate-800/60 text-slate-400 hover:text-white',
                'group flex items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-300 ease-in-out',
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
              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
              : 'hover:bg-slate-800/60 text-slate-400 hover:text-white',
            "group flex items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-300 ease-in-out",
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

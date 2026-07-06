'use client';

import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { showToast } from '@/utils';
import { signOut, useSession } from 'next-auth/react';
import { GlobalSearch } from './GlobalSearch';
import { NotificationDropdown } from './NotificationDropdown';


interface HeaderProps {
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
  toggleDesktopCollapse?: () => void;
}

export function Header({ isCollapsed = false, toggleCollapse, toggleDesktopCollapse }: HeaderProps) {
  const { data: session } = useSession();

  const displayName = session?.user?.name || "Loading...";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white/70 backdrop-blur-xl px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Mobile sidebar toggle */}
      <button type="button" className="-m-2.5 p-2.5 text-slate-700 lg:hidden" onClick={toggleCollapse}>
        <span className="sr-only">Open sidebar</span>
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Desktop collapse/expand button */}
      {toggleDesktopCollapse && (
        <Button variant="ghost" size="icon" onClick={toggleDesktopCollapse} className="hidden lg:flex h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100">
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      )}

      {/* Separator */}
      <div className="h-6 w-px bg-slate-200 lg:hidden" aria-hidden="true" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <GlobalSearch />

        <div className="flex items-center gap-x-4 lg:gap-x-6 ml-auto">
          <NotificationDropdown />

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200" aria-hidden="true" />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-x-2 outline-none">
              <span className="sr-only">Open user menu</span>
              <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm transition-transform hover:scale-105 cursor-pointer">
                {session?.user?.image && <AvatarImage src={session.user.image} alt={displayName} />}
                <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                  {displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden lg:flex lg:flex-col lg:items-start lg:justify-center lg:ml-2 text-left">
                <span className="text-sm font-semibold leading-none text-slate-900" aria-hidden="true">
                  {displayName}
                </span>
                <span className="text-xs font-medium text-slate-500 mt-1 uppercase">
                  {((session as any)?.position) || "Member"}
                </span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-xl">
              <DropdownMenuGroup>
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">Profile</DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">Settings</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
                onClick={() => {
                  showToast.confirm("Are you sure you want to sign out?", () => {
                    signOut({ callbackUrl: '/login' });
                  }, "You will need to sign in again to access the dashboard.");
                }}
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

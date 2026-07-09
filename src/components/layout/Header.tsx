'use client';

import { Menu, ChevronLeft, ChevronRight, MessageSquare, LogOut } from 'lucide-react';
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
import { ChatPanel } from './ChatPanel';
import { useState } from 'react';
import axios from 'axios';
import { UserProfileModal } from '@/components/users/UserProfileModal';
import { UserData } from '@/interfaces/user';


interface HeaderProps {
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
  toggleDesktopCollapse?: () => void;
}

export function Header({ isCollapsed = false, toggleCollapse, toggleDesktopCollapse }: HeaderProps) {
  const { data: session } = useSession();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserData | null>(null);

  const handleOpenProfile = async () => {
    setIsProfileModalOpen(true);
    try {
      const res = await axios.get('/api/users');
      if (res.data.status === 'success') {
        const currentUserId = (session as any)?.id;
        const me = res.data.data.find((u: UserData) => u.id === currentUserId);
        if (me) setUserProfile(me);
      }
    } catch (error) {
      console.error("Failed to fetch user profile", error);
    }
  };

  const displayName = session?.user?.name || "Loading...";

  return (
    <>
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
            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-x-2 outline-none">
                <span className="sr-only">Open user menu</span>
                <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm transition-transform hover:scale-105 cursor-pointer">
                  {session?.user?.image && <AvatarImage src={session.user.image} alt={displayName} />}
                  <AvatarFallback className="bg-emerald-600 text-white font-semibold">
                    {displayName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:flex lg:flex-col lg:items-start lg:justify-center lg:ml-2 text-left">
                  <span className="text-sm font-semibold leading-none text-slate-900" aria-hidden="true">
                    {displayName}
                  </span>
                  <span className="text-xs font-medium text-slate-500 mt-1 uppercase">
                    {((session as any)?.position) || "IT PROGRAMMER SUPERVISOR"}
                  </span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-xl">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={handleOpenProfile}>Profile</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">Settings</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Separator */}
            <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200" aria-hidden="true" />

            {/* Chat button */}
            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              className="-m-2.5 p-2.5 text-slate-400 hover:text-slate-600 transition-colors relative"
              title="Google Chat"
            >
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </button>

            <NotificationDropdown />

            {/* Separator */}
            <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200" aria-hidden="true" />

            {/* Logout Button */}
            <Button
              variant="ghost"
              onClick={() => {
                showToast.confirm("Are you sure you want to sign out?", () => {
                  signOut({ callbackUrl: '/login' });
                }, "You will need to sign in again to access the dashboard.");
              }}
              className="text-slate-500 hover:text-red-600 hover:bg-red-50 h-9 px-3 -ml-2"
            >
              <LogOut className="h-4 w-4 lg:mr-2" />
              <span className="hidden lg:block"></span>
            </Button>
          </div>
        </div>
      </header>

      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      
      <UserProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userProfile={userProfile}
        onUpdated={handleOpenProfile}
      />
    </>
  );
}

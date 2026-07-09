"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import axios from "axios";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const remindedEventsRef = useRef<Set<string>>(new Set());

  // Meeting reminder: check upcoming Google Calendar events
  useEffect(() => {
    const checkUpcoming = async () => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const res = await axios.get(`/api/calendar/events?year=${year}&month=${month}`);
        if (res.data.status !== "success") return;
        const events: any[] = res.data.data;
        events.forEach(ev => {
          if (!ev.start || ev.isAllDay) return;
          const evStart = new Date(ev.start);
          const diffMs = evStart.getTime() - now.getTime();
          const diffMin = diffMs / 60000;
          // Alert if event is 10-15 minutes away and not yet reminded
          if (diffMin >= 0 && diffMin <= 15 && !remindedEventsRef.current.has(ev.id)) {
            remindedEventsRef.current.add(ev.id);
            const minLeft = Math.round(diffMin);
            // Push to local notifications list
            setNotifications(prev => [{
              id: `gcal-reminder-${ev.id}`,
              title: `ใกล้ถึงเวลาประชุม`,
              message: `${ev.summary} ใน ${minLeft} นาที${ev.location ? ` — ${ev.location}` : ''}`,
              is_read: "false",
              link: ev.hangoutLink || ev.htmlLink || null,
              created_at: new Date().toISOString(),
              type: 'calendar',
            }, ...prev]);
            setUnreadCount(c => c + 1);
          }
        });
      } catch {
        // silent fail
      }
    };
    checkUpcoming();
    const interval = setInterval(checkUpcoming, 60000); // check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchNotifications();
    
    // Auto-refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get("/api/notifications");
      if (res.data.status === "success") {
        setNotifications(prev => {
          // Keep local calendar reminders
          const locals = prev.filter(n => n.id && n.id.toString().startsWith('gcal-reminder-'));
          return [...locals, ...res.data.data];
        });
        
        setUnreadCount(prev => {
          // We need to count the unread from API + local unread
          const apiUnread = res.data.data.filter((n: any) => String(n.is_read) !== "true").length;
          // In this simple implementation, local reminders are always unread until dismissed,
          // but handleMarkAsRead might mark them as read in the array.
          return apiUnread; // We'll let the local reminder logic increment it
        });
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const handleMarkAsRead = async (id?: string) => {
    try {
      if (id) {
        if (id.toString().startsWith('gcal-reminder-')) {
          setNotifications(prev => prev.filter(n => n.id !== id));
          setUnreadCount(prev => Math.max(0, prev - 1));
          return;
        }
        await axios.put("/api/notifications", { notification_id: id });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: "true" } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        await axios.put("/api/notifications", { mark_all: true });
        // When marking all as read, we can remove local gcal reminders or keep them unread
        // Let's remove local gcal reminders since they are "read"
        setNotifications(prev => prev.map(n => ({ ...n, is_read: "true" })).filter(n => !n.id || !n.id.toString().startsWith('gcal-reminder-')));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative -m-2.5 p-2.5 text-slate-400 hover:text-slate-500 outline-none">
        <span className="sr-only">View notifications</span>
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-white/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold text-slate-900">Notifications</span>
          {unreadCount > 0 && (
            <button 
              onClick={() => handleMarkAsRead()}
              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
            >
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No notifications yet.
            </div>
          ) : (
            notifications.map((notif) => (
              <DropdownMenuItem 
                key={notif.id} 
                className={`flex flex-col items-start p-3 cursor-pointer ${String(notif.is_read) !== "true" ? "bg-slate-50" : ""}`}
                onClick={() => {
                  if (String(notif.is_read) !== "true") {
                    handleMarkAsRead(notif.id);
                  }
                  if (notif.link) {
                    window.open(notif.link, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                <div className="flex justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-slate-400" />
                    <span className={`text-sm font-medium ${String(notif.is_read) !== "true" ? "text-slate-900" : "text-slate-700"}`}>
                      {notif.title}
                    </span>
                  </div>
                  {String(notif.is_read) !== "true" && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                  )}
                </div>
                <span className="text-xs text-slate-500 line-clamp-2">{notif.message}</span>
                <span className="text-[10px] text-slate-400 mt-2">
                  {notif.created_at && !isNaN(new Date(notif.created_at).getTime()) 
                    ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }) 
                    : ''}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

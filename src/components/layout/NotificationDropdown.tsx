"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import axios from "axios";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    
    // Auto-refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get("/api/notifications");
      if (res.data.status === "success") {
        setNotifications(res.data.data);
        setUnreadCount(res.data.data.filter((n: any) => String(n.is_read) !== "true").length);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  const handleMarkAsRead = async (id?: string) => {
    try {
      if (id) {
        await axios.put("/api/notifications", { notification_id: id });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: "true" } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        await axios.put("/api/notifications", { mark_all: true });
        setNotifications(prev => prev.map(n => ({ ...n, is_read: "true" })));
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
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-base">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button 
              onClick={() => handleMarkAsRead()}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
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
                    window.location.href = notif.link;
                  }
                }}
              >
                <div className="flex justify-between w-full mb-1">
                  <span className={`text-sm font-medium ${String(notif.is_read) !== "true" ? "text-slate-900" : "text-slate-700"}`}>
                    {notif.title}
                  </span>
                  {String(notif.is_read) !== "true" && (
                    <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0 mt-1" />
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

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { Send, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface TaskDiscussionProps {
  taskId: string;
}

export function TaskDiscussion({ taskId }: TaskDiscussionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('/api/users');
        if (res.data.status === 'success') {
          setUsers(res.data.data);
        }
      } catch (err) {}
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchComments();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`task_${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'TaskComment',
          filter: `task_id=eq.${taskId}`
        },
        (payload) => {
          // Re-fetch to get user details, or could manually append if we had the user info
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  useEffect(() => {
    // Scroll to bottom when new comments arrive
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const fetchComments = async () => {
    try {
      const res = await axios.get(`/api/tasks/${taskId}/comments`);
      if (res.data.status === 'success') {
        setComments(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch comments", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewComment(val);
    
    // Check if we are typing a mention
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
      const filter = val.slice(lastAt + 1);
      if (!filter.includes(' ')) {
        setMentionFilter(filter.toLowerCase());
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };
  
  const handleSelectMention = (user: any) => {
    const lastAt = newComment.lastIndexOf('@');
    const before = newComment.slice(0, lastAt);
    const name = user.name_en || user.name_th || user.emp_id;
    setNewComment(`${before}@${name} `);
    setShowMentions(false);
    document.getElementById('comment-input')?.focus();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    const content = newComment.trim();
    setNewComment('');
    setShowMentions(false);

    // detect mentions from content and map to user IDs
    const mentionNames = content.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];
    const mentionIds = mentionNames.map(name => {
      const u = users.find(u => u.name_en === name || u.name_th === name || u.emp_id === name);
      return u ? u.id : null;
    }).filter(Boolean);
    
    try {
      await axios.post(`/api/tasks/${taskId}/comments`, {
        content,
        mentions: mentionIds
      });
      // realtime will trigger re-fetch
    } catch (error) {
      console.error("Failed to post comment", error);
      alert("Failed to send message");
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading discussion...</div>;
  }

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {comments.length === 0 ? (
          <div className="text-center text-sm text-slate-400 mt-10">
            No comments yet. Start the discussion!
          </div>
        ) : (
          comments.map((comment) => {
            const isMe = (session as any)?.id === comment.user_id;
            return (
              <div key={comment.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4 text-slate-500" />
                </div>
                <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-700">
                      {comment.user?.name_th || comment.user?.name_en || 'Unknown'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className={`px-4 py-2 rounded-2xl text-sm ${
                    isMe 
                      ? 'bg-emerald-600 text-white rounded-tr-sm' 
                      : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
                  }`}>
                    {comment.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      
      <div className="p-3 border-t border-slate-200 bg-white relative">
        {showMentions && users.length > 0 && (
          <div className="absolute bottom-full mb-1 left-3 w-64 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-50">
            {users
              .filter(u => 
                (u.name_en?.toLowerCase() || '').includes(mentionFilter) || 
                (u.name_th?.toLowerCase() || '').includes(mentionFilter) ||
                (u.emp_id?.toLowerCase() || '').includes(mentionFilter)
              )
              .slice(0, 5)
              .map(u => (
                <div 
                  key={u.id} 
                  className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                  onClick={() => handleSelectMention(u)}
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                    {(u.name_en || u.name_th || 'U')[0]}
                  </div>
                  <div>
                    <div className="font-medium text-slate-700">{u.name_en || u.name_th}</div>
                    <div className="text-[10px] text-slate-400">{u.department?.name || u.position || u.emp_id}</div>
                  </div>
                </div>
              ))}
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            id="comment-input"
            type="text"
            value={newComment}
            onChange={handleInputChange}
            autoComplete="off"
            placeholder="Type your message... use @ to mention"
            className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="p-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

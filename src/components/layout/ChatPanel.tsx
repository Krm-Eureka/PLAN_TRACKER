"use client";

import { useState, useEffect, useRef } from "react";
import { X, Send, MessageSquare, Users, User, Loader2, ChevronLeft, Plus, Search } from "lucide-react";
import axios from "axios";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";

interface Space {
  name: string;
  displayName: string;
  type: string;
  singleUserBotDm: boolean;
}

interface Message {
  name: string;
  text: string;
  sender: string;
  senderEmail: string;
  createTime: string | null;
  thread: string | null;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSpacesOnMobile, setShowSpacesOnMobile] = useState(true);
  const [panelWidth, setPanelWidth] = useState(672); // Default max-w-2xl
  const isDragging = useRef(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      // Panel is anchored to the right, width is screen width - mouse X
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 350 && newWidth < window.innerWidth - 50) {
        setPanelWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = 'default';
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  const myName = session?.user?.name || "";

  useEffect(() => {
    if (isOpen) fetchSpaces();
  }, [isOpen]);

  useEffect(() => {
    if (!searchQuery.trim() || !showNewChatModal) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get(`/api/people/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.data.status === "success") {
          setSearchResults(res.data.data);
        }
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, showNewChatModal]);

  useEffect(() => {
    if (selectedSpace) fetchMessages(selectedSpace.name);
  }, [selectedSpace]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchSpaces = async () => {
    setLoadingSpaces(true);
    setError(null);
    try {
      const res = await axios.get("/api/chat/spaces");
      if (res.data.status === "success") {
        setSpaces(res.data.data);
        if (res.data.data.length > 0 && !selectedSpace) {
          setSelectedSpace(res.data.data[0]);
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Unknown error";
      const status = err?.response?.status;
      setError(`Chat API Error${status ? ` (${status})` : ''}: ${msg}`);
      console.error("ChatPanel fetchSpaces error:", err?.response?.data || err);
    } finally {
      setLoadingSpaces(false);
    }
  };

  const handleCreateChat = async (user: any) => {
    setCreatingChat(true);
    try {
      const res = await axios.post("/api/chat/spaces/create", { targetUser: user.resourceName });
      if (res.data.status === "success") {
        await fetchSpaces();
        setShowNewChatModal(false);
        setSearchQuery("");
        // Select the newly created space if possible
        if (res.data.data?.name) {
          const newSpace = res.data.data;
          setSelectedSpace({
            name: newSpace.name,
            displayName: newSpace.displayName || user.name,
            type: newSpace.type || "DIRECT_MESSAGE",
            singleUserBotDm: newSpace.singleUserBotDm || false
          });
          setShowSpacesOnMobile(false);
        }
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to create chat. Please make sure you have granted the required permissions by re-logging in.");
    } finally {
      setCreatingChat(false);
    }
  };

  const fetchMessages = async (spaceName: string) => {
    setLoadingMessages(true);
    try {
      const res = await axios.get(`/api/chat/messages?space=${encodeURIComponent(spaceName)}`);
      if (res.data.status === "success") setMessages(res.data.data);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedSpace || sending) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage("");
    try {
      const res = await axios.post("/api/chat/messages", { spaceName: selectedSpace.name, text });
      if (res.data.status === "success") {
        setMessages(prev => [...prev, {
          name: res.data.data.name,
          text: res.data.data.text,
          sender: "You",
          senderEmail: "",
          createTime: res.data.data.createTime,
          thread: null,
        }]);
      }
    } catch {
      setNewMessage(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const getSpaceIcon = (space: Space) => {
    if (space.type === "DIRECT_MESSAGE") return <User className="w-4 h-4" />;
    return <Users className="w-4 h-4" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div 
        style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : `${panelWidth}px`, maxWidth: '100%' }}
        className="relative z-10 bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300"
      >
        {/* Resizer Handle */}
        <div 
          className="hidden md:block absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-50 hover:bg-emerald-500/20 active:bg-emerald-500/40 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            isDragging.current = true;
            document.body.style.cursor = 'col-resize';
          }}
        />
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-900">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-white">Google Chat</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-700 h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          {/* Spaces list */}
          <div className={`flex-shrink-0 border-r border-slate-200 bg-slate-50 flex-col overflow-y-auto w-full md:w-64 ${!showSpacesOnMobile ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 sticky top-0 bg-slate-50/95 backdrop-blur z-10">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Spaces</span>
              <button 
                onClick={() => setShowNewChatModal(true)}
                title="Create New Chat"
                className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center hover:bg-emerald-200 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {loadingSpaces ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : error ? (
              <div className="px-3 py-4 text-xs text-red-500">{error}</div>
            ) : spaces.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-400">ไม่พบ Spaces</div>
            ) : (
              spaces.map(space => (
                <button
                  key={space.name}
                  onClick={() => { setSelectedSpace(space); setShowSpacesOnMobile(false); }}
                  className={`flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors w-full border-b border-slate-100 ${
                    selectedSpace?.name === space.name
                      ? "bg-emerald-50 text-emerald-700 font-medium"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${selectedSpace?.name === space.name ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {getSpaceIcon(space)}
                  </div>
                  <span className="truncate flex-1">{space.displayName}</span>
                </button>
              ))
            )}
          </div>

          {/* Messages */}
          <div className={`flex-1 flex-col overflow-hidden bg-slate-100 ${showSpacesOnMobile ? 'hidden md:flex' : 'flex'}`}>
            {selectedSpace ? (
              <>
                {/* Space title */}
                <div className="px-4 py-3 border-b border-slate-200 bg-white shadow-sm z-10 flex items-center gap-3">
                  <button className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 shrink-0" onClick={() => setShowSpacesOnMobile(true)}>
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    {getSpaceIcon(selectedSpace)}
                  </div>
                  <span className="font-semibold text-slate-900 text-base truncate">{selectedSpace.displayName}</span>
                </div>

                {/* Message list */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/50">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-sm text-slate-400 py-8 bg-white/50 rounded-xl border border-dashed border-slate-200 mx-4">ยังไม่มีข้อความ</div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isMe = msg.sender === "You" || msg.sender === myName;
                      return (
                        <div key={idx} className={`flex gap-3 w-full ${isMe ? 'justify-end' : 'justify-start'} items-end`}>
                          {!isMe && (
                            <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0 shadow-sm">
                              {(msg.sender?.[0] || "?").toUpperCase()}
                            </div>
                          )}
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                            <div className={`flex items-baseline gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                              <span className="text-xs font-medium text-slate-500">{isMe ? 'คุณ' : msg.sender}</span>
                              {msg.createTime && (
                                <span className="text-[10px] text-slate-400">
                                  {formatDistanceToNow(new Date(msg.createTime), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                            <div className={`px-4 py-2.5 text-sm shadow-sm whitespace-pre-wrap leading-relaxed ${isMe ? 'bg-emerald-600 text-white rounded-2xl rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm'}`}>
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-slate-200 bg-white">
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="พิมพ์ข้อความ... (Enter เพื่อส่ง)"
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400"
                    />
                    <Button
                      size="icon"
                      onClick={handleSend}
                      disabled={!newMessage.trim() || sending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 w-9 shrink-0"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                เลือก Space เพื่อเริ่มสนทนา
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNewChatModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-semibold text-slate-800">เริ่มการสนทนาใหม่</h3>
              <button onClick={() => setShowNewChatModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ หรือ อีเมลพนักงาน..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  autoFocus
                />
              </div>
              
              <div className="mt-4 max-h-[300px] overflow-y-auto">
                {searching ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <span className="text-xs">กำลังค้นหา...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-1">
                    {searchResults.map((user: any) => (
                      <button
                        key={user.resourceName}
                        onClick={() => handleCreateChat(user)}
                        disabled={creatingChat}
                        className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors text-left disabled:opacity-50"
                      >
                        <Avatar className="w-10 h-10">
                          {user.photoUrl && <AvatarImage src={user.photoUrl} referrerPolicy="no-referrer" />}
                          <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">
                            {(user.name?.[0] || "?").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                          <div className="font-medium text-slate-800 truncate">{user.name}</div>
                          <div className="text-xs text-slate-500 truncate">{user.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : searchQuery.trim() ? (
                  <div className="py-8 text-center text-slate-400 text-sm">ไม่พบผู้ใช้งานนี้</div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-sm">พิมพ์ชื่อเพื่อค้นหาผู้ที่ต้องการแชทด้วย</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

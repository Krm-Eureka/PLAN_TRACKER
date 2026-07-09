'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Loader2, Paperclip, Send, X, ExternalLink, Search, CheckCircle2, Circle } from 'lucide-react';
import { ProjectData, TaskData } from '@/interfaces';
import axios from 'axios';
import { showToast } from '@/utils/toast';
import { exportToPDF } from '@/utils/export';
import { Task } from 'gantt-task-react';
import { useSession } from 'next-auth/react';

interface EmailUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectData;
  tasks: TaskData[];
  ganttTasks: Task[];
}

export function EmailUpdateModal({ isOpen, onClose, project, tasks, ganttTasks }: EmailUpdateModalProps) {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [signature, setSignature] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [message, setMessage] = useState('');
  const [attachPdf, setAttachPdf] = useState(true);

  // Initial auto-search
  useEffect(() => {
    if (isOpen && (project.project_code || project.project_email_update)) {
      const initialQuery = project.project_email_update || project.project_code;
      setSearchQuery(initialQuery);
      handleSearch(initialQuery);
    }
  }, [isOpen, project.project_code, project.project_email_update]);

  useEffect(() => {
    if (!isOpen || !hasSearched) return;
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch(searchQuery);
      } else {
        setThreads([]);
        setSelectedThread(null);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, hasSearched]);

  // Auto-fill To and Cc for Reply All
  useEffect(() => {
    if (selectedThread) {
      const userEmail = session?.user?.email || '';
      
      const toAddresses = [selectedThread.from, selectedThread.to]
        .filter(Boolean)
        .join(', ')
        .split(',')
        .map(s => s.trim())
        .filter(s => s && !s.includes(userEmail)); // Remove user's own email
        
      const ccAddresses = (selectedThread.cc || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s && !s.includes(userEmail));

      // Remove duplicates
      const uniqueTo = Array.from(new Set(toAddresses)).join(', ');
      const uniqueCc = Array.from(new Set(ccAddresses)).join(', ');

      setTo(uniqueTo);
      setCc(uniqueCc);
    } else {
      setTo('');
      setCc('');
    }
  }, [selectedThread, session]);

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setHasSearched(true);
    try {
      const res = await axios.get(`/api/mail/thread?q=${encodeURIComponent(query)}`);
      if (res.data?.data) {
        setThreads(res.data.data.threads || []);
        setSignature(res.data.data.signature || '');
        
        // Auto-select the first thread if it exists and we haven't manually selected one yet
        if (res.data.data.threads && res.data.data.threads.length > 0 && !selectedThread) {
          setSelectedThread(res.data.data.threads[0]);
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch threads:", error);
      if (error.response?.data?.message) {
        showToast.error(`Gmail Error: ${error.response.data.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!to) {
      showToast.error("Please specify at least one recipient (To)");
      return;
    }

    setIsSending(true);
    showToast.info("Preparing email...");

    try {
      let pdfBase64 = '';
      let pdfFilename = '';

      if (attachPdf) {
        const exporterName = session?.user?.name || (session?.user as any)?.name_en || session?.user?.email || 'Unknown User';
        const pdfData = await exportToPDF(ganttTasks, tasks, project, exporterName, true);
        if (pdfData && typeof pdfData === 'object' && 'base64' in pdfData) {
          pdfBase64 = pdfData.base64;
          pdfFilename = pdfData.filename;
        }
      }

      const htmlMessage = message.replace(/\n/g, '<br/>');
      const finalHtmlBody = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          ${htmlMessage}
          <br/><br/>
          ${signature}
        </div>
      `;

      await axios.post('/api/mail/send', {
        to,
        cc,
        subject: selectedThread?.subject || `Update: [${project.project_code}] ${project.project_name}`,
        htmlBody: finalHtmlBody,
        threadId: selectedThread?.threadId,
        inReplyTo: selectedThread?.originalMessageId,
        references: selectedThread?.references,
        pdfBase64,
        pdfFilename
      });

      showToast.success("Email sent successfully!");
      onClose();
    } catch (error) {
      console.error(error);
      showToast.error("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Send Project Update</h3>
              <p className="text-xs text-slate-500">{project.project_code} - {project.project_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Search Bar */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Search Email Thread</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by project code, name, or subject..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setHasSearched(true);
                }}
                className="w-full text-sm rounded-md border border-slate-200 pl-9 pr-10 py-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50"
              />
              {isLoading && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin absolute right-3 top-3" />}
            </div>
          </div>

          {/* Thread List */}
          {hasSearched && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase">Select Thread to Reply To</span>
                <button 
                  onClick={() => {
                    setSelectedThread(null);
                    setHasSearched(false);
                    setSearchQuery('');
                  }}
                  className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${!selectedThread ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                  New Thread (Don't Reply)
                </button>
              </div>
              
              <div className="max-h-40 overflow-y-auto">
                {threads.length === 0 && !isLoading ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    No matching email threads found.
                  </div>
                ) : (
                  threads.map(t => (
                    <div 
                      key={t.threadId}
                      onClick={() => setSelectedThread(t)}
                      className={`p-3 border-b border-slate-100 last:border-0 cursor-pointer transition-colors flex items-start gap-3 hover:bg-indigo-50/50 ${selectedThread?.threadId === t.threadId ? 'bg-indigo-50/80' : ''}`}
                    >
                      <div className="mt-0.5">
                        {selectedThread?.threadId === t.threadId ? (
                          <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="text-sm font-semibold text-slate-800 truncate pr-2">{t.subject || '(No Subject)'}</h4>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {t.internalDate ? new Date(parseInt(t.internalDate)).toLocaleDateString('en-GB') : ''}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mb-1">From: {t.from}</p>
                        <p className="text-[11px] text-slate-600 italic bg-white/60 line-clamp-1" dangerouslySetInnerHTML={{ __html: t.snippet }}></p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Email Form */}
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">To</label>
              <input
                type="text"
                placeholder="client@company.com, manager@company.com"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full text-sm rounded-md border border-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 h-10 px-3"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cc</label>
              <input
                type="text"
                placeholder="cc@company.com"
                value={cc}
                onChange={e => setCc(e.target.value)}
                className="w-full text-sm rounded-md border border-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 h-10 px-3"
              />
            </div>
            {!selectedThread && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="Email Subject"
                  value={project.project_code ? `Update: [${project.project_code}] ${project.project_name}` : `Update: ${project.project_name}`}
                  disabled
                  className="w-full text-sm rounded-md border border-slate-200 bg-slate-50 text-slate-500 outline-none h-10 px-3"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Message</label>
              <textarea
                placeholder="Type your update message here..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full text-sm rounded-md border border-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 p-3 min-h-[120px] resize-y"
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <input
                type="checkbox"
                id="attachPdf"
                checked={attachPdf}
                onChange={e => setAttachPdf(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
              />
              <label htmlFor="attachPdf" className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <Paperclip className="w-4 h-4 text-slate-500" />
                Attach Gantt Chart PDF Report
              </label>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || isLoading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {isSending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
            ) : (
              <><Send className="w-4 h-4" /> Send Update</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

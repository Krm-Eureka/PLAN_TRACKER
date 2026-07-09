"use client"

import React, { useSyncExternalStore } from 'react';
import { useLoadingStore } from '@/store/useLoadingStore';
import { Loader2 } from 'lucide-react';

export function GlobalLoader() {
  const { isLoading, message } = useSyncExternalStore(
    useLoadingStore.subscribe,
    useLoadingStore.getState,
    useLoadingStore.getState
  );

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-emerald-900 font-medium animate-pulse">{message}</p>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import { Mail, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { signOut } from 'next-auth/react';

export function UnregisteredUserPopup() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-red-500 p-6 flex flex-col items-center justify-center text-white relative">
          <div className="bg-white/20 p-4 rounded-full mb-4">
            <ShieldAlert size={48} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-center">ยังไม่มีสิทธิ์เข้าใช้งาน</h2>
        </div>
        
        <div className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
            บัญชีของคุณเข้าสู่ระบบได้สำเร็จ แต่ยังไม่มีข้อมูลและสิทธิ์ในการเข้าถึงในฐานข้อมูลระบบ
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl mb-8 border border-blue-100 dark:border-blue-800 flex items-start text-left gap-3">
            <AlertCircle className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
                กรุณาติดต่อแผนก IT เพื่อเพิ่มข้อมูล
              </p>
              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
                <Mail size={16} />
                <a 
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=it@eurekaautomation.co.th" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:underline font-medium"
                >
                  it@eurekaautomation.co.th
                </a>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-sm shadow-red-200"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

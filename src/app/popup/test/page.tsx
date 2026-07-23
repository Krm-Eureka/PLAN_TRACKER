import React from 'react';
import { UnregisteredUserPopup } from '@/components/ui/UnregisteredUserPopup';

export default function PopupTestPage() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-8">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md max-w-2xl text-center">
        <h1 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white">หน้าต่างทดสอบ Popup</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          ด้านล่างนี้คือเนื้อหาของเว็บปกติ แต่จะมี Popup เด้งขึ้นมาซ้อนทับเพื่อแจ้งเตือนให้ติดต่อ IT
        </p>
        
        <div className="grid grid-cols-2 gap-4 mt-8 opacity-50">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="col-span-2 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>

      {/* เรียกใช้งาน Popup */}
      <UnregisteredUserPopup />
    </div>
  );
}

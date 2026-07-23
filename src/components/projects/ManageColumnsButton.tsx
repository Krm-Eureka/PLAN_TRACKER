"use client";

import React, { useState } from 'react';
import { Columns } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ManageColumnsModal } from './ManageColumnsModal';
import { useRouter } from 'next/navigation';

interface ManageColumnsButtonProps {
  project: any;
}

export function ManageColumnsButton({ project }: ManageColumnsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="gap-2 text-slate-700 bg-white border-slate-200 hover:bg-slate-50 shadow-sm"
      >
        <Columns className="w-4 h-4" />
        Custom Fields
      </Button>
      
      {isOpen && (
        <ManageColumnsModal 
          project={project} 
          onClose={() => setIsOpen(false)} 
          onUpdated={() => {
            router.refresh();
          }}
        />
      )}
    </>
  );
}

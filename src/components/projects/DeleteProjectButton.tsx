"use client"

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { DeleteProjectModal } from './DeleteProjectModal';
import { ProjectData } from '@/interfaces';

interface DeleteProjectButtonProps {
  project: ProjectData;
  iconOnly?: boolean;
}

export function DeleteProjectButton({ project, iconOnly }: DeleteProjectButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button 
        variant="outline" 
        size={iconOnly ? "icon" : "default"}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(true); }}
        className={`gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors ${iconOnly ? 'h-8 w-8' : ''}`}
      >
        <Trash2 className="w-4 h-4" />
        {!iconOnly && <span className="hidden sm:inline">Delete</span>}
      </Button>

      <DeleteProjectModal 
        project={project}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

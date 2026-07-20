"use client"

import React, { useState } from 'react'
import { Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EditProjectModal } from './EditProjectModal'
import { useRouter } from 'next/navigation'
import { UserData, ProjectData } from '@/interfaces'

interface EditProjectButtonProps {
  users: UserData[];
  project: ProjectData;
  departments?: { id: string, name: string }[];
}

export function EditProjectButton({ users, project, departments = [] }: EditProjectButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleSaved = () => {
    router.refresh()
  }

  return (
    <>
      <Button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        variant="outline"
        size="icon"
        title="Edit Project"
        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
      >
        <Edit3 className="w-4 h-4" />
      </Button>

      <EditProjectModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSaved={handleSaved}
        users={users}
        project={project}
        departments={departments}
      />
    </>
  )
}

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
}

export function EditProjectButton({ users, project }: EditProjectButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleSaved = () => {
    router.refresh()
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
      >
        <Edit3 className="w-4 h-4" />
        Edit Project
      </Button>

      <EditProjectModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSaved={handleSaved}
        users={users}
        project={project}
      />
    </>
  )
}

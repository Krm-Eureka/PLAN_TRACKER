"use client"

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddTaskModal } from './AddTaskModal'
import { useRouter } from 'next/navigation'

interface AddTaskButtonProps {
  users: { id: string; emp_id: string; name_en: string; name_th: string; department?: string; position?: string; email?: string }[];
  projectId: string;
}

export function AddTaskButton({
  users,
  projectId,
  projectCode
}: {
  users: any[],
  projectId: string,
  projectCode?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleSaved = () => {
    router.refresh()
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
      >
        <Plus className="w-4 h-4" />
        Add Task
      </Button>

      <AddTaskModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSaved={handleSaved}
        users={users as any}
        projectId={projectId}
      />
    </>
  )
}

"use client"

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddTaskModal } from './AddTaskModal'
import { useRouter } from 'next/navigation'

import { UserData, TaskData } from '@/interfaces';

export function AddTaskButton({
  users,
  projectId,
  projectDepartment,
  tasks = []
}: {
  users: UserData[],
  projectId: string,
  projectDepartment?: string,
  tasks?: TaskData[]
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
        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
      >
        <Plus className="w-4 h-4" />
        Add Task
      </Button>

      <AddTaskModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSaved={handleSaved}
        users={users}
        projectId={projectId}
        projectDepartment={projectDepartment}
        tasks={tasks}
      />
    </>
  )
}

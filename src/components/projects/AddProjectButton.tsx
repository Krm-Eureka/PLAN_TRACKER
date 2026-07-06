"use client"

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddProjectModal } from './AddProjectModal'
import { useRouter } from 'next/navigation'
import { UserData } from '@/interfaces' // <--- เพิ่มการ import UserData

interface AddProjectButtonProps {
  users: UserData[];
  projectCode?: string;
}

export function AddProjectButton({ users, projectCode }: AddProjectButtonProps) {
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
        Add Project
      </Button>

      <AddProjectModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSaved={handleSaved}
        users={users}
      />
    </>
  )
}

"use client"

import React, { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RescheduleProjectModal } from './RescheduleProjectModal'
import { useRouter } from 'next/navigation'
import { ProjectData } from '@/interfaces'

interface RescheduleProjectButtonProps {
  project: ProjectData
}

export function RescheduleProjectButton({ project }: RescheduleProjectButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleSaved = () => {
    router.refresh()
  }

  return (
    <>
      <Button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(true)
        }}
        variant="outline"
        size="sm"
        title="เลื่อนแผนโปรเจกต์"
        className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
      >
        <CalendarClock className="w-4 h-4" />
        <span className="hidden sm:inline">เลื่อนแผน</span>
      </Button>

      <RescheduleProjectModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSaved={handleSaved}
        project={project}
      />
    </>
  )
}

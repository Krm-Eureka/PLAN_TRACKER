"use client"

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { CalendarClock, X, ChevronRight, AlertTriangle, CalendarOff, ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { showToast } from '@/utils'
import { ProjectData } from '@/interfaces'
import { formatDateDDMMYYYY } from '@/utils/date'

type Mode = 'shift_days' | 'set_end_date' | 'on_hold'

interface RescheduleProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  project: ProjectData
}

function shiftDate(dateStr: string, deltaDays: number): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().split('T')[0]
}

export function RescheduleProjectModal({ isOpen, onClose, onSaved, project }: RescheduleProjectModalProps) {
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<Mode>('shift_days')
  const [shiftDays, setShiftDays] = useState(7)
  const [newEndDate, setNewEndDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (isOpen) {
      setMode('shift_days')
      setShiftDays(7)
      setNewEndDate(project.end_date || '')
    }
  }, [isOpen, project])

  if (!isOpen || !mounted) return null

  // Compute preview values
  const previewStartDate = mode === 'shift_days' && project.start_date
    ? shiftDate(project.start_date, shiftDays)
    : project.start_date || ''

  const previewEndDate = mode === 'shift_days' && project.end_date
    ? shiftDate(project.end_date, shiftDays)
    : mode === 'set_end_date'
      ? newEndDate
      : project.end_date || ''

  const computedDelta = mode === 'set_end_date' && project.end_date && newEndDate
    ? Math.round((new Date(newEndDate).getTime() - new Date(project.end_date).getTime()) / (1000 * 60 * 60 * 24))
    : mode === 'shift_days' ? shiftDays : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        project_id: project.id || project.project_code,
        mode,
      }

      if (mode === 'shift_days') {
        if (!shiftDays || shiftDays === 0) {
          showToast.error('Invalid', 'Please enter a non-zero number of days.')
          return
        }
        payload.shift_days = shiftDays
      } else if (mode === 'set_end_date') {
        if (!newEndDate) {
          showToast.error('Invalid', 'Please select a new end date.')
          return
        }
        payload.new_end_date = newEndDate
      }

      const res = await axios.put('/api/projects/reschedule', payload)

      if (res.data.status === 'success') {
        showToast.success(
          'Rescheduled',
          res.data.message || 'Project rescheduled successfully.'
        )
        onSaved()
        onClose()
      } else {
        throw new Error(res.data.message)
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      showToast.error('Error', e.response?.data?.message || e.message || 'Failed to reschedule project')
    } finally {
      setIsSubmitting(false)
    }
  }

  const modeOptions: { value: Mode; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    {
      value: 'shift_days',
      label: 'เลื่อนตามจำนวนวัน',
      desc: 'เลื่อนวันที่ทั้งหมดไปข้างหน้าตามจำนวนวันที่กำหนด',
      icon: <Clock className="w-5 h-5" />,
      color: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    },
    {
      value: 'set_end_date',
      label: 'กำหนดวันสิ้นสุดใหม่',
      desc: 'ระบุวันที่สิ้นสุดใหม่ ระบบจะคำนวณวันที่เลื่อนให้อัตโนมัติ',
      icon: <CalendarClock className="w-5 h-5" />,
      color: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    {
      value: 'on_hold',
      label: 'เลื่อนไม่มีกำหนด (On Hold)',
      desc: 'ระงับโปรเจกต์ชั่วคราว สถานะจะเปลี่ยนเป็น On Hold ทั้ง Project และ Task',
      icon: <CalendarOff className="w-5 h-5" />,
      color: 'border-amber-200 bg-amber-50 text-amber-700',
    },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <CalendarClock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">เลื่อนแผนโปรเจกต์</h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[260px]">{project.project_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">

          {/* Mode selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">เลือกวิธีเลื่อน</label>
            <div className="space-y-2">
              {modeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border-2 transition duration-150 ${
                    mode === opt.value ? opt.color + ' border-current shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">{opt.icon}</span>
                  <div>
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                  </div>
                  {mode === opt.value && (
                    <ChevronRight className="w-4 h-4 ml-auto mt-0.5 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-specific inputs */}
          {mode === 'shift_days' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                จำนวนวันที่เลื่อน
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShiftDays(d => Math.max(-999, d - 1))}
                    className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-lg transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={shiftDays}
                    onChange={(e) => setShiftDays(parseInt(e.target.value) || 0)}
                    className="flex-1 text-center text-2xl font-bold text-slate-800 focus:outline-none py-2"
                  />
                  <button
                    type="button"
                    onClick={() => setShiftDays(d => d + 1)}
                    className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-lg transition-colors"
                  >
                    +
                  </button>
                </div>
                <span className="text-slate-500 font-medium text-sm">วัน</span>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {[7, 14, 30, 60, 90].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setShiftDays(d)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      shiftDays === d
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    +{d} วัน
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'set_end_date' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                วันที่สิ้นสุดใหม่
              </label>
              <input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                min={project.start_date || undefined}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
              />
            </div>
          )}

          {mode === 'on_hold' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">การตั้งค่า On Hold จะ:</p>
                <ul className="list-disc list-inside space-y-1 text-amber-700">
                  <li>เปลี่ยนสถานะ Project เป็น "On Hold"</li>
                  <li>เปลี่ยน Tasks ที่ยังไม่เสร็จทุกตัวเป็น "On Hold"</li>
                  <li>Tasks ที่เป็น Done หรือ Cancel จะไม่ถูกเปลี่ยน</li>
                </ul>
              </div>
            </div>
          )}

          {/* Preview */}
          {mode !== 'on_hold' && (project.start_date || project.end_date) && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                ตัวอย่างผลลัพธ์
                {computedDelta !== null && computedDelta !== 0 && (
                  <span className={`ml-2 font-bold ${computedDelta > 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                    {computedDelta > 0 ? `+${computedDelta}` : computedDelta} วัน
                  </span>
                )}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {project.start_date && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">วันเริ่มต้น</p>
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="text-slate-400 line-through">{formatDateDDMMYYYY(project.start_date)}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-semibold text-indigo-600">{formatDateDDMMYYYY(previewStartDate) || previewStartDate}</span>
                    </div>
                  </div>
                )}
                {project.end_date && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">วันสิ้นสุด</p>
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="text-slate-400 line-through">{formatDateDDMMYYYY(project.end_date)}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-semibold text-indigo-600">{formatDateDDMMYYYY(previewEndDate) || previewEndDate}</span>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                * Tasks ที่มีสถานะ Done หรือ Cancel จะไม่ถูกเลื่อน
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={`text-white ${
                mode === 'on_hold'
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isSubmitting
                ? 'กำลังดำเนินการ...'
                : mode === 'on_hold'
                  ? 'ตั้งเป็น On Hold'
                  : 'ยืนยันการเลื่อน'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

"use client"

import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlanModal } from './PlanModal'
import { showToast } from '@/utils/toast'
import axios from 'axios'

interface Plan {
  emp_id: string;
  name: string;
  start_date: string;
  location: string;
  duration_days: string;
}

export function InteractiveCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPlans = async () => {
    try {
      setIsLoading(true)
      const res = await axios.get('/api/plans')
      if (res.data.status === 'success') {
        setPlans(res.data.data)
      }
    } catch (error) {
      console.error("Error fetching plans:", error)
      showToast.error("Failed to load plans", "Could not fetch data from Google Sheets")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setIsModalOpen(true)
  }

  const handlePlanSaved = () => {
    fetchPlans()
  }

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  // Get padding days for the first week to align to Sunday
  const startDay = startOfMonth(currentMonth).getDay()
  const paddingDays = Array.from({ length: startDay }).map((_, i) => i)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-800">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-2 text-center text-sm font-semibold text-slate-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto">
        {paddingDays.map((_, i) => (
          <div key={`padding-${i}`} className="border-r border-b border-slate-100 bg-slate-50/50" />
        ))}
        
        {daysInMonth.map((date) => {
          // Find plans for this date
          const dayPlans = plans.filter(p => {
            if (!p.start_date) return false;
            try {
              const planStart = new Date(p.start_date);
              const duration = parseInt(p.duration_days || '1', 10) - 1;
              const planEnd = new Date(planStart);
              planEnd.setDate(planEnd.getDate() + duration);
              
              return date >= planStart && date <= planEnd;
            } catch (e) {
              return false;
            }
          });

          return (
            <div 
              key={date.toISOString()} 
              onClick={() => handleDateClick(date)}
              className={`border-r border-b border-slate-100 p-2 min-h-[100px] cursor-pointer hover:bg-indigo-50/30 transition-colors relative group ${
                isToday(date) ? 'bg-indigo-50/10' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <span className={`inline-flex items-center justify-center w-6 h-6 text-sm font-medium rounded-full ${
                  isToday(date) ? 'bg-indigo-600 text-white' : 'text-slate-700 group-hover:text-indigo-600'
                }`}>
                  {format(date, 'd')}
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-4 h-4 text-indigo-400" />
                </span>
              </div>

              <div className="mt-2 space-y-1">
                {isLoading && (
                  <div className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
                )}
                {!isLoading && dayPlans.map((plan, idx) => (
                  <div 
                    key={idx} 
                    className="text-[10px] sm:text-xs px-1.5 py-1 bg-emerald-100 text-emerald-800 rounded truncate flex items-center gap-1 border border-emerald-200"
                    title={`${plan.name}: ${plan.location}`}
                  >
                    <MapPin className="w-3 h-3 shrink-0 opacity-70" />
                    <span className="font-semibold">{plan.name.split(' ')[0]}</span>: {plan.location}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <PlanModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        selectedDate={selectedDate}
        onSaved={handlePlanSaved}
      />
    </div>
  )
}

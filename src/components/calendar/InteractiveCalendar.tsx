"use client"

import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlanModal } from './PlanModal'
import { DayPlanSidebar } from './DayPlanSidebar'
import { showToast } from '@/utils'
import axios from 'axios'
import { ProjectData } from '@/interfaces'

interface Plan {
  id: string;
  user_id: string;
  project_id?: string;
  emp_id: string;
  name: string;
  start_date: string;
  location: string;
  duration_days: string;
}

export function InteractiveCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [plansRes, projectsRes] = await Promise.all([
        axios.get('/api/plans'),
        axios.get('/api/projects')
      ])
      
      if (plansRes.data.status === 'success') {
        setPlans(plansRes.data.data)
      }
      
      if (projectsRes.data.status === 'success') {
        setProjects(projectsRes.data.data)
      }
    } catch (error) {
      console.error("Error fetching calendar data:", error)
      showToast.error("Failed to load data", "Could not fetch data from Google Sheets")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Timeout to avoid setting state synchronously during render in React 18+ strict mode
    const tid = setTimeout(() => fetchData(), 0);
    return () => clearTimeout(tid);
  }, [])

  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setIsSidebarOpen(true)
  }

  const handlePlanSaved = () => {
    fetchData()
  }

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  // Get padding days for the first week to align to Sunday
  const startDay = startOfMonth(currentMonth).getDay()
  const paddingDays = Array.from({ length: startDay }).map((_, i) => i)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
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
              planStart.setHours(0, 0, 0, 0); // Reset time to midnight for accurate comparison
              const duration = parseInt(p.duration_days || '1', 10) - 1;
              const planEnd = new Date(planStart);
              planEnd.setDate(planEnd.getDate() + duration);
              planEnd.setHours(23, 59, 59, 999); // Set to end of the day
              
              return date >= planStart && date <= planEnd;
            } catch {
              return false;
            }
          });

          return (
            <div 
              key={date.toISOString()} 
              onClick={() => handleDateClick(date)}
              className={`border-r border-b border-slate-100 p-2 min-h-[60px] cursor-pointer hover:bg-indigo-50/30 transition-colors relative group flex flex-col ${
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

              <div className="mt-2 space-y-1 overflow-hidden">
                {isLoading && (
                  <div className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
                )}
                {!isLoading && dayPlans.slice(0, 3).map((plan, idx) => (
                  <div 
                    key={idx} 
                    className="text-[10px] sm:text-xs px-1.5 py-1 bg-emerald-100 text-emerald-800 rounded truncate flex items-center gap-1 border border-emerald-200"
                    title={`${plan.name}: ${plan.location}`}
                  >
                    <MapPin className="w-2.5 h-2.5 shrink-0 opacity-70" />
                    <span className="truncate">{(plan.name || '').split(' ')[0]}: {plan.location}</span>
                  </div>
                ))}
                {!isLoading && dayPlans.length > 3 && (
                  <div className="text-[10px] font-medium text-slate-500 px-1 mt-0.5">
                    + {dayPlans.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <DayPlanSidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        selectedDate={selectedDate}
        plans={selectedDate ? plans.filter(p => {
          if (!p.start_date) return false;
          try {
            const planStart = new Date(p.start_date);
            planStart.setHours(0, 0, 0, 0);
            const duration = parseInt(p.duration_days || '1', 10) - 1;
            const planEnd = new Date(planStart);
            planEnd.setDate(planEnd.getDate() + duration);
            planEnd.setHours(23, 59, 59, 999);
            
            return selectedDate >= planStart && selectedDate <= planEnd;
          } catch {
            return false;
          }
        }) : []}
        projects={projects}
        onAddNewClick={() => {
          setEditingPlan(null);
          setIsModalOpen(true);
        }}
        onEditClick={(plan) => {
          setEditingPlan(plan);
          setIsModalOpen(true);
        }}
        onPlanDeleted={fetchData}
      />

      <PlanModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingPlan(null);
        }} 
        selectedDate={selectedDate}
        onSaved={handlePlanSaved}
        projects={projects}
        initialData={editingPlan}
      />
    </div>
  )
}

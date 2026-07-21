"use client"

import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, MapPin, CalendarDays, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlanModal } from './PlanModal'
import { DayPlanSidebar } from './DayPlanSidebar'
import { showToast } from '@/utils'
import { parseSafeDate } from '@/utils/date'
import axios from 'axios'
import { ProjectData } from '@/interfaces'

interface GoogleEvent {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  location: string | null;
  hangoutLink: string | null;
  htmlLink: string | null;
  isAllDay: boolean;
  source: 'personal' | 'group';
}

interface Plan {
  id: string;
  user_id: string;
  project_id?: string;
  emp_id: string;
  name: string;
  start_date: string;
  location: string;
  duration_days: string;
  start_time?: string;
  end_time?: string;
  companions?: string;
}

export function InteractiveCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('it_tracker_calendar_month');
      if (saved) {
        const parsed = new Date(saved);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    return new Date();
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('it_tracker_calendar_month', currentMonth.toISOString());
    }
  }, [currentMonth]);

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async (forceRefresh = false) => {
    try {
      setIsLoading(true)
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const bust = forceRefresh ? `?t=${Date.now()}` : '';
      const [plansRes, projectsRes, tasksRes, usersRes, calRes] = await Promise.all([
        axios.get(`/api/plans${bust}`),
        axios.get('/api/projects'),
        axios.get('/api/tasks?limit=10000'),
        axios.get(`/api/users${bust}`),
        axios.get(`/api/calendar/events?year=${year}&month=${month}`).catch(() => null),
      ])

      if (plansRes.data.status === 'success') {
        setPlans(plansRes.data.data)
      }

      if (projectsRes.data.status === 'success') {
        setProjects(projectsRes.data.data)
      }

      if (tasksRes.data.status === 'success') {
        setTasks(tasksRes.data.data)
      }

      if (usersRes.data.status === 'success') {
        setUsers(usersRes.data.data)
      }

      if (calRes?.data?.status === 'success') {
        setGoogleEvents(calRes.data.data)
      }
    } catch (error) {
      console.error("Error fetching calendar data:", error)
      showToast.error("Failed to load data", "Could not fetch data from Google Sheets")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const tid = setTimeout(() => fetchData(), 0);
    return () => clearTimeout(tid);
  }, [currentMonth])

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
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
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
      <div
        className="flex-1 grid grid-cols-7 overflow-y-auto"
        style={{ gridAutoRows: 'minmax(120px, auto)' }}
      >
        {paddingDays.map((_, i) => (
          <div key={`padding-${i}`} className="border-r border-b border-slate-100 bg-slate-50/50" />
        ))}

        {daysInMonth.map((date) => {
          // Sort plans by start date and duration to keep row positions consistent
          const sortedPlans = [...plans].sort((a, b) => {
            const startTimeA = parseSafeDate(a.start_date)?.getTime() || 0;
            const startTimeB = parseSafeDate(b.start_date)?.getTime() || 0;
            if (startTimeA !== startTimeB) return startTimeA - startTimeB;
            return parseInt(b.duration_days || '1') - parseInt(a.duration_days || '1');
          });

          // Find plans for this date
          const dayPlans = sortedPlans.filter(p => {
            if (!p.start_date) return false;
            try {
              const planStart = parseSafeDate(p.start_date);
              if (!planStart) return false;
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
              className={`border-r border-b border-slate-100 p-2 cursor-pointer hover:bg-emerald-50/30 transition-colors relative group flex flex-col ${isToday(date) ? 'bg-emerald-50/10' : ''
                }`}
            >
              <div className="flex justify-between items-start">
                <span className={`inline-flex items-center justify-center w-6 h-6 text-sm font-medium rounded-full ${isToday(date) ? 'bg-emerald-600 text-white' : 'text-slate-700 group-hover:text-emerald-600'
                  }`}>
                  {format(date, 'd')}
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-4 h-4 text-emerald-400" />
                </span>
              </div>

              <div className="mt-2 space-y-1">
                {isLoading && (
                  <div className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
                )}
                {!isLoading && dayPlans.slice(0, 2).map((plan, idx) => {
                  const project = projects.find(p => p.id === plan.project_id || p.project_code === plan.project_id);
                  const projectName = project ? (project.project_name || project.project_code) : null;
                  const timeStr = plan.start_time ? ` (${plan.start_time}${plan.end_time ? ` - ${plan.end_time}` : ''})` : '';

                  const companionIds = (plan.companions || '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
                  const companionNames = companionIds.map(cid => {
                    const cu = users.find(u => String(u.id || '').trim().toLowerCase() === cid);
                    return cu ? (cu.name_en || cu.name_th || cu.email || 'Someone') : 'Someone';
                  });
                  const companionsStr = companionNames.length > 0 ? ` (with ${companionNames.join(', ')})` : '';

                  const tooltipText = projectName
                    ? `${plan.name}${companionsStr}${timeStr}: ${plan.location} | Project: ${projectName}`
                    : `${plan.name}${companionsStr}${timeStr}: ${plan.location}`;

                  const planOwner = users.find(u => u.id === plan.user_id);
                  const displayColor = project?.color || planOwner?.color;

                  const dynamicStyle = displayColor ? {
                    backgroundColor: `${displayColor}15`,
                    borderColor: `${displayColor}40`,
                    color: displayColor
                  } : {};

                  const planStart = parseSafeDate(plan.start_date) || new Date();
                  planStart.setHours(0, 0, 0, 0);
                  const duration = parseInt(plan.duration_days || '1', 10) - 1;
                  const planEnd = new Date(planStart);
                  planEnd.setDate(planEnd.getDate() + duration);
                  planEnd.setHours(0, 0, 0, 0);

                  const currentDate = new Date(date);
                  currentDate.setHours(0, 0, 0, 0);

                  const isStart = currentDate.getTime() === planStart.getTime();
                  const isEnd = currentDate.getTime() === planEnd.getTime();
                  const isSun = currentDate.getDay() === 0;

                  const showText = isStart || isSun;

                  // Calculate how many days to span in the current row
                  const currentTs = currentDate.getTime();
                  const endTs = planEnd.getTime();
                  const daysLeft = Math.round((endTs - currentTs) / (1000 * 60 * 60 * 24)) + 1;
                  const daysToEndOfWeek = 7 - currentDate.getDay();
                  const spanDays = Math.max(1, Math.min(daysLeft, daysToEndOfWeek));

                  return (
                    <div key={idx} className="relative h-[26px] shrink-0">
                      {showText && (
                        <div
                          className="absolute top-0 left-0 h-full text-[10px] sm:text-xs px-1.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200 flex items-center gap-1 overflow-hidden shadow-sm"
                          style={{
                            width: `calc(${spanDays * 100}% + ${(spanDays - 1) * 17}px)`,
                            zIndex: 20,
                            ...dynamicStyle
                          }}
                          title={tooltipText}
                        >
                          <MapPin className="w-2.5 h-2.5 shrink-0 opacity-70" />
                          <span className="truncate font-medium">{(plan.name || '').split(' ')[0]}{companionsStr ? ' & Co.' : ''}: {plan.location}</span>
                        </div>
                      )}
                      {/* Invisible placeholder to maintain row height and push other events down */}
                      <div className="opacity-0 pointer-events-none h-full w-full">.</div>
                    </div>
                  );
                })}

                {/* Google Calendar Events */}
                {!isLoading && googleEvents
                  .filter(ev => {
                    if (!ev.start) return false;
                    try {
                      const evDate = new Date(ev.start);
                      return isSameDay(evDate, date);
                    } catch { return false; }
                  })
                  .slice(0, 2)
                  .map((ev, idx) => {
                    const isGroup = ev.source === 'group';
                    const timeLabel = ev.isAllDay ? '' : (() => {
                      try { return format(new Date(ev.start!), 'HH:mm'); } catch { return ''; }
                    })();
                    return (
                      <a
                        key={`gcal-${idx}`}
                        href={ev.hangoutLink || ev.htmlLink || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className={`text-[10px] sm:text-xs px-1.5 py-1 rounded truncate flex items-center gap-1 shrink-0 border ${isGroup
                            ? 'bg-violet-100 text-violet-800 border-violet-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        title={`${ev.summary}${ev.location ? ' @ ' + ev.location : ''}`}
                      >
                        {isGroup ? <Users className="w-2.5 h-2.5 shrink-0 opacity-70" /> : <CalendarDays className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                        <span className="truncate">{timeLabel && <>{timeLabel} </>}{ev.summary}</span>
                      </a>
                    );
                  })
                }

                {!isLoading && (dayPlans.length + googleEvents.filter(ev => { try { return isSameDay(new Date(ev.start!), date); } catch { return false; } }).length) > 4 && (
                  <div className="text-[10px] font-medium text-slate-500 px-1 mt-0.5">
                    + more
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
            const planStart = parseSafeDate(p.start_date);
            if (!planStart) return false;
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
        users={users}
        onAddNewClick={() => {
          setEditingPlan(null);
          setIsModalOpen(true);
        }}
        onEditClick={(plan) => {
          setEditingPlan(plan);
          setIsModalOpen(true);
        }}
        onPlanDeleted={() => fetchData(true)}
      />

      <PlanModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPlan(null);
        }}
        onSaved={handlePlanSaved}
        selectedDate={selectedDate}
        projects={projects}
        tasks={tasks}
        users={users}
        initialData={editingPlan}
      />
    </div>
  )
}

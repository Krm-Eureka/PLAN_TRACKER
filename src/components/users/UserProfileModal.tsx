"use client"

import React, { useState, useEffect } from 'react'
import { X, Save, Edit3, User, Mail, Phone, Hash, Building2, MapPin, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { showToast } from '@/utils'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { UserData } from '@/interfaces/user'
import { createPortal } from 'react-dom'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  userProfile: UserData | null
  onUpdated: () => void
}

export function UserProfileModal({ isOpen, onClose, userProfile, onUpdated }: UserProfileModalProps) {
  const [mounted, setMounted] = useState(false)
  const { data: session, update } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    name_th: '',
    name_en: '',
    nickname: '',
    telephone: '',
    color: '#10b981'
  })

  useEffect(() => {
    setMounted(true)
    if (isOpen && userProfile) {
      setFormData({
        name_th: userProfile.name_th || '',
        name_en: userProfile.name_en || '',
        nickname: userProfile.nickname || '',
        telephone: userProfile.telephone || '',
        color: userProfile.color || '#10b981'
      })
      setIsEditing(false)
    }
  }, [isOpen, userProfile])

  if (!isOpen || !userProfile || !mounted) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check permissions
    const currentUserId = (session as any)?.id;
    const currentUserRole = ((session as any)?.role_system || '').toLowerCase();
    const isSuperUser = currentUserRole.includes('admin') || currentUserRole.includes('superadmin');
    
    if (currentUserId !== userProfile.id && !isSuperUser) {
      showToast.error("Permission Denied", "You can only edit your own profile.");
      return;
    }

    try {
      setIsSaving(true)
      
      const res = await axios.put(`/api/users/${userProfile.id}`, formData)
      
      if (res.data.status === 'success') {
        showToast.success('Profile Updated', 'Your information has been saved successfully.')
        setIsEditing(false)
        onUpdated()
        
        // If it's the current user, update session? NextAuth session update might be needed,
        // but typically a page reload or re-fetching users handles it.
        // update() can trigger session refresh if needed.
      } else {
        throw new Error(res.data.message)
      }
    } catch (error: any) {
      showToast.error('Update Failed', error.response?.data?.message || error.message || 'Something went wrong')
    } finally {
      setIsSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Background */}
        <div 
          className="h-32 w-full absolute top-0 left-0"
          style={{ backgroundColor: formData.color, opacity: 0.15 }}
        />
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-500 hover:text-slate-900 shadow-sm transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Profile Header section */}
        <div className="relative pt-12 px-8 pb-6 flex flex-col items-center text-center">
          <div className="relative">
            <Avatar className="w-24 h-24 border-4 border-white shadow-xl bg-white relative z-10">
              <AvatarImage src={(session as any)?.user?.image} />
              <AvatarFallback 
                className="text-3xl font-bold text-white"
                style={{ backgroundColor: formData.color }}
              >
                {formData.name_en ? formData.name_en.substring(0, 2).toUpperCase() : 'U'}
              </AvatarFallback>
            </Avatar>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="absolute bottom-0 right-0 z-20 p-1.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 shadow-lg transform translate-x-2 translate-y-2 transition-transform hover:scale-110"
                title="Edit Profile"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          
          <div className="mt-4 z-10">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {formData.name_en || 'Unknown User'}
            </h2>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">
              {userProfile.position || 'Employee'}
            </p>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-8 pb-8 overflow-y-auto custom-scrollbar flex-1">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
              
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-emerald-600" />
                  Personal Details
                </h3>
                
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Name (EN)</label>
                  <input
                    type="text"
                    value={formData.name_en}
                    onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                    className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-colors"
                    placeholder="e.g. John Doe"
                  />
                </div>
                
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Name (TH)</label>
                  <input
                    type="text"
                    value={formData.name_th}
                    onChange={e => setFormData({ ...formData, name_th: e.target.value })}
                    className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-colors"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Nickname</label>
                    <input
                      type="text"
                      value={formData.nickname}
                      onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                      className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Telephone</label>
                    <input
                      type="tel"
                      value={formData.telephone}
                      onChange={e => setFormData({ ...formData, telephone: e.target.value })}
                      className="w-full text-sm p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4 text-emerald-600" />
                  Theme & Style
                </h3>
                
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Profile Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                      className="h-10 w-16 cursor-pointer rounded border border-slate-200 bg-white p-1"
                    />
                    <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200 text-slate-600">
                      {formData.color.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="h-9">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                  <Save className="w-4 h-4 mr-1.5" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-300 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                  <Hash className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Emp ID</p>
                    <p className="text-sm font-semibold text-slate-700">{userProfile.emp_id || '-'}</p>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Department</p>
                    <p className="text-sm font-semibold text-slate-700 truncate" title={userProfile.department}>
                      {userProfile.department || '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Thai Name</p>
                    <p className="text-sm font-medium text-slate-700">{formData.name_th || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email Address</p>
                    <p className="text-sm font-medium text-slate-700 truncate">{userProfile.email || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Telephone</p>
                    <p className="text-sm font-medium text-slate-700">{formData.telephone || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

"use client";

import React, { useState } from 'react';
import axios from 'axios';
import { X, Plus, Trash2 } from 'lucide-react';

interface ManageColumnsModalProps {
  project: any;
  onClose: () => void;
  onUpdated: () => void;
}

export function ManageColumnsModal({ project, onClose, onUpdated }: ManageColumnsModalProps) {
  const [columns, setColumns] = useState<any[]>(
    Array.isArray(project.custom_columns) ? project.custom_columns : []
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleAddColumn = () => {
    setColumns([
      ...columns,
      { id: crypto.randomUUID(), key: `col_${Date.now()}`, label: 'New Column', type: 'text' }
    ]);
  };

  const handleRemoveColumn = (id: string) => {
    setColumns(columns.filter(c => c.id !== id));
  };

  const handleChange = (id: string, field: string, value: string) => {
    setColumns(columns.map(c => {
      if (c.id === id) {
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axios.put(`/api/projects/${project.id}`, {
        custom_columns: columns
      });
      onUpdated();
      onClose();
    } catch (error) {
      console.error("Failed to update columns:", error);
      alert("Failed to save columns.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">Manage Custom Fields</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <p className="text-sm text-slate-500 mb-4">
            Add custom fields to track specific information for tasks in this project.
          </p>
          
          {columns.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No custom fields yet. Click "Add Field" to create one.
            </div>
          ) : (
            columns.map((col, idx) => (
              <div key={col.id} className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Field Name</label>
                      <input
                        type="text"
                        value={col.label}
                        onChange={(e) => handleChange(col.id, 'label', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Field Type</label>
                      <select
                        value={col.type}
                        onChange={(e) => handleChange(col.id, 'type', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="link">Link / URL</option>
                        <option value="status">Status Label</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleRemoveColumn(col.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors mt-6"
                  title="Remove Field"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}

          <button
            onClick={handleAddColumn}
            className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 border-dashed"
          >
            <Plus className="w-4 h-4" />
            Add Custom Field
          </button>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Fields"}
          </button>
        </div>
      </div>
    </div>
  );
}

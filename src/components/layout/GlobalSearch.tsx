"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Folder, CheckSquare, Loader2 } from "lucide-react";
import axios from "axios";
import { useRouter } from "next/navigation";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ projects: any[], tasks: any[] }>({ projects: [], tasks: [] });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Simple debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length > 1) {
        performSearch(query);
      } else {
        setResults({ projects: [], tasks: [] });
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.data.status === "success") {
        setResults(res.data.data);
        setIsOpen(res.data.data.projects.length > 0 || res.data.data.tasks.length > 0);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(path);
  };

  return (
    <div ref={wrapperRef} className="relative flex flex-1 w-full max-w-2xl">
      <div className="relative w-full">
        <label htmlFor="search-field" className="sr-only">Search</label>
        <Search
          className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-slate-400 flex items-center justify-center my-auto"
          aria-hidden="true"
        />
        <input
          id="search-field"
          className="block h-full w-full border-0 py-2 pl-8 pr-3 text-slate-900 placeholder:text-slate-400 focus:ring-0 sm:text-sm bg-transparent outline-none"
          placeholder="Search tasks or projects..."
          type="text"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen && e.target.value.trim().length > 1) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length > 1 && (results.projects.length > 0 || results.tasks.length > 0)) {
              setIsOpen(true);
            }
          }}
        />
        {loading && (
          <div className="absolute inset-y-0 right-3 flex items-center">
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute top-full left-0 w-[280px] sm:w-[400px] md:w-[600px] max-w-[calc(100vw-2rem)] mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="max-h-[400px] overflow-y-auto py-2">
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mb-2 text-emerald-500" />
                <p className="text-sm">Searching...</p>
              </div>
            ) : results.projects.length === 0 && results.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <Search className="w-8 h-8 mb-2 text-slate-300" />
                <p className="text-sm">No results found for "{query}"</p>
              </div>
            ) : (
              <>
                {/* Projects */}
                {results.projects.length > 0 && (
                  <div className="px-3 py-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Projects</h3>
                    <div className="space-y-1">
                      {results.projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleNavigate(`/projects/${encodeURIComponent(p.project_code || p.id)}`)}
                          className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50 flex items-start gap-3 transition-colors"
                        >
                          <div className="mt-0.5 bg-blue-100 p-1.5 rounded-md text-blue-600 shrink-0">
                            <Folder className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-slate-900 leading-snug">
                              [{p.project_code}] {p.project_name}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 line-clamp-2">{p.client_name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tasks */}
                {results.tasks.length > 0 && (
                  <>
                    {results.projects.length > 0 && <div className="h-px bg-slate-100 my-2 mx-3" />}
                    <div className="px-3 py-2">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Tasks</h3>
                      <div className="space-y-1">
                        {results.tasks.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              const id = t.project_code || t.project_id;
                              if (id) handleNavigate(`/projects/${encodeURIComponent(id)}`);
                              else handleNavigate('/tasks');
                            }}
                            className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50 flex items-start gap-3 transition-colors"
                          >
                            <div className="mt-0.5 bg-emerald-100 p-1.5 rounded-md text-emerald-600 shrink-0">
                              <CheckSquare className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-slate-900 leading-snug">
                                {t.task_name}
                              </div>
                              <div className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description || "No description"}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

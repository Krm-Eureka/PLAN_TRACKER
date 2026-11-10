"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { api as axios } from "@/lib/axios";
import {
  formatRecipients,
  isValidEmail,
  parseRecipients,
  type Recipient,
} from "@/utils/recipients";

interface RecipientInputProps {
  label: string;
  /** ข้อความผู้รับแบบเดิม "Name <email>, ..." — เก็บรูปแบบเดิมไว้ ส่วนส่งเมลจึงไม่ต้องแก้ */
  value: string;
  onChange: (value: string) => void;
  /** รายชื่อที่แนะนำได้ทันที เช่น คนในเธรดอีเมลนี้ */
  suggestions?: Recipient[];
  /** อีเมลที่ไม่ควรแนะนำ เช่น อีเมลของผู้ส่งเอง */
  exclude?: string[];
  placeholder?: string;
}

const MAX_SUGGESTIONS = 8;

function initials(r: Recipient) {
  const base = (r.name || r.email).trim();
  return base.slice(0, 1).toUpperCase();
}

/**
 * ช่องผู้รับแบบ chip + ค้นหาอัตโนมัติ
 * - พิมพ์ 2 ตัวอักษรขึ้นไป → ค้นจากรายชื่อพนักงานใน Google Workspace + คนในเธรดอีเมล
 * - Enter / Tab / , / ; เพื่อเพิ่ม, Backspace ในช่องว่างเพื่อลบคนล่าสุด, วางรายชื่อหลายคนได้
 */
export function RecipientInput({ label, value, onChange, suggestions = [], exclude = [], placeholder }: RecipientInputProps) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [directory, setDirectory] = useState<Recipient[]>([]);
  const [searching, setSearching] = useState(false);

  const recipients = parseRecipients(value);
  const chosen = new Set(recipients.map((r) => r.email.toLowerCase()));
  const excluded = new Set(exclude.map((e) => e.toLowerCase()));

  // ค้นรายชื่อพนักงาน (หน่วง 250ms ลดการเรียก API)
  const query = text.trim();
  useEffect(() => {
    if (query.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get(`/api/people/search?q=${encodeURIComponent(query)}`);
        if (!cancelled) {
          setDirectory(
            ((res.data?.data ?? []) as { name?: string; email?: string }[])
              .filter((p) => p.email)
              .map((p) => ({ name: p.name && p.name !== "Unknown" ? p.name : "", email: String(p.email) }))
          );
        }
      } catch {
        if (!cancelled) setDirectory([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const q = query.toLowerCase();
  const pool = [...suggestions, ...(query.length >= 2 ? directory : [])];
  const seen = new Set<string>();
  const options = pool
    .filter((r) => {
      const key = r.email.toLowerCase();
      if (seen.has(key) || chosen.has(key) || excluded.has(key)) return false;
      seen.add(key);
      return !q || r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    })
    .slice(0, MAX_SUGGESTIONS);
  const typedIsEmail = isValidEmail(query) && !chosen.has(q);
  const showList = open && (options.length > 0 || typedIsEmail || (searching && query.length >= 2));

  const commit = (list: Recipient[]) => {
    onChange(formatRecipients([...recipients, ...list.filter((r) => !chosen.has(r.email.toLowerCase()))]));
    setText("");
    setActive(0);
  };

  const commitTyped = () => {
    if (options[active] && (!typedIsEmail || active < options.length)) {
      commit([options[active]]);
      return true;
    }
    const parsed = parseRecipients(text);
    if (parsed.length > 0) {
      commit(parsed);
      return true;
    }
    return false;
  };

  const remove = (email: string) => {
    onChange(formatRecipients(recipients.filter((r) => r.email.toLowerCase() !== email.toLowerCase())));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(0, options.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" || e.key === "," || e.key === ";" || (e.key === "Tab" && text.trim())) {
      if (text.trim() && commitTyped()) e.preventDefault();
      else if (e.key === "Enter") e.preventDefault(); // กันส่งฟอร์มโดยไม่ตั้งใจ
    } else if (e.key === "Backspace" && !text && recipients.length > 0) {
      remove(recipients[recipients.length - 1].email);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
        {recipients.length > 0 && <span className="ml-1 font-normal normal-case text-slate-400">({recipients.length} คน)</span>}
      </label>
      <div
        className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20"
        onClick={() => inputRef.current?.focus()}
      >
        {recipients.map((r) => {
          const valid = isValidEmail(r.email);
          return (
            <span
              key={r.email}
              title={r.name ? `${r.name} <${r.email}>` : r.email}
              className={`inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-1 pr-1.5 text-sm ${
                valid ? "border-indigo-200 bg-indigo-50 text-indigo-900" : "border-rose-300 bg-rose-50 text-rose-700"
              }`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${valid ? "bg-indigo-200 text-indigo-800" : "bg-rose-200 text-rose-800"}`}>
                {initials(r)}
              </span>
              <span className="truncate">{r.name || r.email}</span>
              {r.name && <span className="hidden truncate text-xs text-slate-500 sm:inline">{r.email}</span>}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(r.email);
                }}
                className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label={`ลบ ${r.name || r.email}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={text}
          placeholder={recipients.length === 0 ? placeholder ?? "พิมพ์ชื่อหรืออีเมล แล้วเลือกจากรายการ" : ""}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // ให้คลิกเลือกในรายการทันก่อนปิด และเก็บอีเมลที่พิมพ์ค้างไว้
            setTimeout(() => {
              setOpen(false);
              if (isValidEmail(text.trim())) commit(parseRecipients(text));
            }, 150);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            const parsed = parseRecipients(pasted);
            if (parsed.length > 1 || (parsed.length === 1 && pasted.includes("@"))) {
              e.preventDefault();
              commit(parsed);
            }
          }}
          onKeyDown={onKeyDown}
          className="min-w-[160px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.map((r, i) => (
            <li
              key={r.email}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                commit([r]);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${i === active ? "bg-indigo-50" : ""}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {initials(r)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-800">{r.name || r.email}</span>
                {r.name && <span className="block truncate text-xs text-slate-500">{r.email}</span>}
              </span>
            </li>
          ))}
          {typedIsEmail && !options.some((o) => o.email.toLowerCase() === q) && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(parseRecipients(query));
              }}
              className="cursor-pointer px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
            >
              + เพิ่ม <span className="font-medium">{query}</span>
            </li>
          )}
          {searching && options.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังค้นหา…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

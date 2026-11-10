"use client";

import { forwardRef, useImperativeHandle, useRef, type InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value"> & {
  /** ค่าแบบ YYYY-MM-DD (เหมือน input type="date") */
  value?: string | null;
  placeholder?: string;
};

/** "2026-07-22" → "22/07/2026" */
function toDisplay(value?: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * ช่องวันที่ที่แสดงเป็น วว/ดด/ปปปป เสมอ (ตรงกับรูปแบบในแอป)
 *
 * input type="date" ของเบราว์เซอร์แสดงรูปแบบตาม locale ของเครื่อง (เช่น 07/22/2026 บน Windows ภาษาอังกฤษ)
 * และ Chrome ไม่สนค่า lang ของหน้าเว็บ จึงซ้อน input จริงแบบโปร่งใสไว้ด้านบน:
 * คลิกแล้วเปิด picker เดิมของเบราว์เซอร์ ส่วนข้อความที่เห็นจัดรูปแบบเอง
 * ค่าที่ส่งออกยังเป็น YYYY-MM-DD และ onChange ได้ event เดิม — ใช้แทน input type="date" ได้ทันที
 */
export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { value, className = "", placeholder = "วว/ดด/ปปปป", disabled, onClick, ...rest },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const display = toDisplay(value);
  // คลาส focus: ของ input เดิมต้องเป็น focus-within: เพราะตัวที่ได้ focus คือ input ข้างใน
  const wrapperClass = className.replace(/(^|\s)focus:/g, "$1focus-within:");

  return (
    <div
      className={`relative flex items-center bg-white ${wrapperClass} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span className={`pointer-events-none flex-1 truncate tabular-nums ${display ? "" : "text-slate-400"}`}>
        {display || placeholder}
      </span>
      <CalendarDays className="pointer-events-none ml-2 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <input
        {...rest}
        ref={inputRef}
        type="date"
        value={value ?? ""}
        disabled={disabled}
        aria-label={rest["aria-label"] ?? (display ? `วันที่ ${display}` : placeholder)}
        onClick={(e) => {
          onClick?.(e);
          try {
            inputRef.current?.showPicker?.();
          } catch {
            // เบราว์เซอร์เก่าที่ไม่มี showPicker: ผู้ใช้ยังพิมพ์/ใช้ปุ่มปฏิทินเดิมได้
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
});

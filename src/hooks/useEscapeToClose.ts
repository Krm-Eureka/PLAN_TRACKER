import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * ปิด modal เมื่อกด Escape (มาตรฐาน dialog ทั่วไป)
 * modal ที่ซ้อนกันจะปิดเฉพาะอันบนสุด เพราะ listener ของอันที่เปิดทีหลังจะทำงานก่อนและหยุด event
 */
export function useEscapeToClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onCloseRef.current();
    };
    // capture + ลงทะเบียนทีหลัง = ทำงานก่อน listener ของ modal ที่อยู่ข้างล่าง
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen]);
}

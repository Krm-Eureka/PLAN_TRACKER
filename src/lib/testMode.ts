/**
 * Playwright test mode (server-side only).
 *
 * ปิดเสมอใน production: แม้จะตั้ง PLAYWRIGHT_TEST=1 บน Vercel ก็จะไม่ข้ามการ login
 * ห้ามใช้ตัวแปร NEXT_PUBLIC_* ตัดสินสิทธิ์ฝั่ง server เพราะถูกฝังลง bundle ตอน build
 */
export const IS_TEST_MODE =
  process.env.NODE_ENV !== "production" && process.env.PLAYWRIGHT_TEST === "1";

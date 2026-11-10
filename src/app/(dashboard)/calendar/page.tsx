import { redirect } from "next/navigation";

// ปฏิทินแผนงานถูกรวมเข้ากับปฏิทินทีม (/weekly) แล้ว — เก็บ path เดิมไว้ให้ลิงก์/bookmark เก่ายังใช้ได้
export default function CalendarPage() {
  redirect("/weekly?view=month");
}

import { MainLayout } from "@/components/layout/MainLayout";
import { getSessionContext } from "@/lib/permissions";
import { UnregisteredUserPopup } from "@/components/ui/UnregisteredUserPopup";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  
  // If the user can login (has a session) but has no ID, they are not in the database
  const isUnregistered = ctx && !ctx.id;

  return (
    <>
      <MainLayout>{children}</MainLayout>
      {isUnregistered && <UnregisteredUserPopup />}
    </>
  );
}

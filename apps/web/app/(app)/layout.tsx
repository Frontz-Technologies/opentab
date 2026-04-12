import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getSession } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "240px" } as React.CSSProperties}
    >
      <AppSidebar orgName={session.org.name} />
      <SidebarInset className="min-h-screen pb-24 md:pb-0">
        {children}
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}

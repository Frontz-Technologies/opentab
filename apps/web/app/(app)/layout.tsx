import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AiChatButton } from "@/components/ai/ai-chat-button";
import { AiChatPanel } from "@/components/ai/ai-chat-panel";
import { getSession } from "@/lib/session";
import { getCountryProvider } from "@/lib/country";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value === "true";

  const provider = getCountryProvider(session.org.countryCode);
  const integrationNav = provider.integrations
    .filter((i) => i.dashboardModule)
    .map((i) => ({
      kind: i.kind,
      label: i.label,
      slug: i.settingsPage?.slug ?? i.kind,
    }));

  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen={sidebarOpen}
        style={
          {
            "--sidebar-width": "240px",
            "--sidebar-width-icon": "64px",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          orgName={session.org.name}
          integrationNav={integrationNav}
        />
        <SidebarInset className="min-h-screen pb-24 md:pb-0">
          {children}
        </SidebarInset>
        <AiChatButton />
        <AiChatPanel />
        <MobileNav />
      </SidebarProvider>
    </TooltipProvider>
  );
}

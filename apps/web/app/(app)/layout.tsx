import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { userPreferences } from "@opentab/db/schema";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AiChatButton } from "@/components/ai/ai-chat-button";
import { AiChatPanel } from "@/components/ai/ai-chat-panel";
import { DemoBanner } from "@/components/demo/demo-banner";
import { NumberFormatProvider } from "@/components/providers/number-format-provider";
import { db } from "@/lib/db";
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

  // Number format is presentation-only — a transient DB blip should never
  // crash the whole authenticated app shell. Mirrors the locale fallback
  // shape in apps/web/i18n/request.ts:37-41.
  let numberFormat = "eu";
  try {
    const prefRows = await db
      .select({ numberFormat: userPreferences.numberFormat })
      .from(userPreferences)
      .where(eq(userPreferences.userId, session.user.id));
    numberFormat = prefRows[0]?.numberFormat ?? "eu";
  } catch (err) {
    console.warn("[AppLayout] numberFormat lookup failed, using eu", err);
  }

  const provider = getCountryProvider(session.org.countryCode);
  const integrationNav = provider.integrations
    .filter((i) => i.dashboardModule)
    .map((i) => ({
      kind: i.kind,
      label: i.label,
      slug: i.settingsPage?.slug ?? i.kind,
    }));

  return (
    <NumberFormatProvider value={numberFormat}>
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
            {session.org.isDemo && <DemoBanner />}
            {children}
          </SidebarInset>
          <AiChatButton />
          <AiChatPanel />
          <MobileNav integrationNav={integrationNav} />
          <Toaster richColors position="top-right" />
        </SidebarProvider>
      </TooltipProvider>
    </NumberFormatProvider>
  );
}

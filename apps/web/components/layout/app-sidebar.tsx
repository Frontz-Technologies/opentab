"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  orgName: string;
}

const navItems = [
  { icon: "dashboard", labelKey: "dashboard", href: "/dashboard" },
  { icon: "receipt_long", labelKey: "invoices", href: "/invoices" },
  { icon: "account_balance_wallet", labelKey: "expenses", href: "/expenses" },
  { icon: "contacts", labelKey: "contacts", href: "/contacts" },
  { icon: "account_tree", labelKey: "projects", href: "/projects" },
] as const;

export function AppSidebar({ orgName }: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <Sidebar
      className="bg-surface-dim/70 glass-effect border-r border-on-surface/10"
      style={{ "--sidebar-width": "240px" } as React.CSSProperties}
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-headline font-semibold text-on-surface text-sm leading-tight">
              OpenTab
            </span>
            <span className="text-on-surface/50 text-xs truncate leading-tight">
              {orgName}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActive}
                  render={<Link href={item.href} />}
                  className={
                    isActive
                      ? "bg-surface-container-low text-primary font-semibold"
                      : "text-on-surface/60 hover:text-on-surface hover:bg-surface-container-low"
                  }
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">
                    {item.icon}
                  </span>
                  <span className="font-label text-sm">
                    {t(item.labelKey)}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-3 flex flex-col gap-2">
        <Link
          href="/invoices/new"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-label font-semibold text-sm hover:from-emerald-400 hover:to-emerald-500 transition-all"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">
            add
          </span>
          {t("createNew")}
        </Link>
        <Link
          href="/settings/company"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface/60 hover:text-on-surface hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] leading-none">
            settings
          </span>
          <span className="font-label text-sm">{t("settings")}</span>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}

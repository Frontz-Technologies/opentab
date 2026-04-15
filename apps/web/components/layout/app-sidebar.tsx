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
  useSidebar,
} from "@/components/ui/sidebar";
interface AppSidebarProps {
  orgName: string;
}

const navItems = [
  { icon: "dashboard", labelKey: "dashboard", href: "/dashboard" },
  { icon: "receipt_long", labelKey: "invoices", href: "/invoices" },
  { icon: "account_balance_wallet", labelKey: "expenses", href: "/expenses" },
  { icon: "contacts", labelKey: "contacts", href: "/contacts" },
  { icon: "inventory_2", labelKey: "products", href: "/products" },
  { icon: "bar_chart", labelKey: "reports", href: "/reports" },
  { icon: "settings", labelKey: "settings", href: "/settings" },
] as const;

export function AppSidebar({ orgName }: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar
      collapsible="icon"
      className="bg-surface-dim/70 glass-effect border-r border-on-surface/10"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-headline font-semibold text-on-surface text-sm leading-tight">
                OpenTab
              </span>
              <span className="text-on-surface/50 text-xs truncate leading-tight">
                {orgName}
              </span>
            </div>
          )}
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
                  tooltip={isCollapsed ? t(item.labelKey) : undefined}
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
                  <span className="font-label text-sm">{t(item.labelKey)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={isCollapsed ? "Expand" : undefined}
              onClick={toggleSidebar}
              className="text-on-surface/60 hover:text-on-surface hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[20px] leading-none">
                {isCollapsed ? "chevron_right" : "chevron_left"}
              </span>
              <span className="font-label text-sm">Collapse</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

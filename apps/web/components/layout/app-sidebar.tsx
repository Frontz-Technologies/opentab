"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
interface IntegrationNavEntry {
  kind: string;
  label: string;
  slug: string;
}

interface AppSidebarProps {
  orgName: string;
  integrationNav?: IntegrationNavEntry[];
}

interface NavItem {
  icon: string;
  labelKey?: string;
  label?: string;
  href: string;
}

interface NavGroup {
  labelKey?: string;
  literalLabel?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [{ icon: "dashboard", labelKey: "dashboard", href: "/dashboard" }],
  },
  {
    labelKey: "sales",
    items: [
      { icon: "receipt_long", labelKey: "invoices", href: "/invoices" },
      { icon: "undo", labelKey: "creditNotes", href: "/credit-notes" },
      { icon: "request_quote", labelKey: "quotes", href: "/quotes" },
    ],
  },
  {
    labelKey: "records",
    items: [
      {
        icon: "account_balance_wallet",
        labelKey: "expenses",
        href: "/expenses",
      },
      { icon: "contacts", labelKey: "contacts", href: "/contacts" },
      { icon: "inventory_2", labelKey: "products", href: "/products" },
    ],
  },
  {
    labelKey: "insights",
    items: [{ icon: "bar_chart", labelKey: "reports", href: "/reports" }],
  },
];

export function AppSidebar({ orgName, integrationNav }: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const groups: NavGroup[] = [...navGroups];
  if (integrationNav && integrationNav.length > 0) {
    groups.push({
      labelKey: "integrations",
      items: integrationNav.map((entry) => ({
        icon: "cloud_sync",
        label: entry.label,
        href: `/integrations/${entry.slug}`,
      })),
    });
  }

  return (
    <Sidebar
      collapsible="icon"
      className="bg-surface-dim/70 glass-effect border-r border-on-surface/10"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-on-primary font-bold text-sm">O</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-headline font-semibold text-on-surface text-sm leading-tight">
                OpenTab
              </span>
              <span
                data-testid="sidebar-org-name"
                className="text-on-surface/50 text-xs truncate leading-tight"
              >
                {orgName}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {groups.map((group, groupIdx) => {
          const groupLabel = group.labelKey
            ? t(group.labelKey)
            : group.literalLabel;
          return (
            <SidebarGroup
              key={group.labelKey ?? group.literalLabel ?? `group-${groupIdx}`}
            >
              {groupLabel && !isCollapsed && (
                <SidebarGroupLabel className="px-3 font-label text-xs uppercase tracking-widest text-on-surface-variant">
                  {groupLabel}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" &&
                        pathname.startsWith(item.href));
                    const itemLabel = item.labelKey
                      ? t(item.labelKey)
                      : (item.label ?? "");
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={isCollapsed ? itemLabel : undefined}
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
                            {itemLabel}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="px-2 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith("/settings")}
              tooltip={isCollapsed ? t("settings") : undefined}
              render={<Link href="/settings" />}
              className={
                pathname.startsWith("/settings")
                  ? "bg-surface-container-low text-primary font-semibold"
                  : "text-on-surface/60 hover:text-on-surface hover:bg-surface-container-low"
              }
            >
              <span className="material-symbols-outlined text-[20px] leading-none">
                settings
              </span>
              <span className="font-label text-sm">{t("settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={isCollapsed ? t("expand") : undefined}
              onClick={toggleSidebar}
              className="text-on-surface/60 hover:text-on-surface hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[20px] leading-none">
                {isCollapsed ? "chevron_right" : "chevron_left"}
              </span>
              <span className="font-label text-sm">{t("collapse")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

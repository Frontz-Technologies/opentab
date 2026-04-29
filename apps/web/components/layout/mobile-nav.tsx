"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Contact,
  LayoutDashboard,
  Package,
  ReceiptText,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { MobileMoreSheet } from "./mobile-more-sheet";

interface IntegrationNavEntry {
  kind: string;
  label: string;
  slug: string;
}

interface MobileNavItem {
  icon: LucideIcon;
  labelKey: string;
  href: string;
}

const navItems: readonly MobileNavItem[] = [
  { icon: LayoutDashboard, labelKey: "dashboard", href: "/dashboard" },
  { icon: ReceiptText, labelKey: "invoices", href: "/invoices" },
  { icon: Wallet, labelKey: "expenses", href: "/expenses" },
  { icon: Contact, labelKey: "contacts", href: "/contacts" },
  { icon: Package, labelKey: "products", href: "/products" },
] as const;

export function MobileNav({
  integrationNav,
}: {
  integrationNav?: IntegrationNavEntry[];
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-dim/90 glass-effect border-t border-on-surface/10">
      <div className="flex items-stretch h-16">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-on-surface/40 hover:text-on-surface/70"
              }`}
            >
              <Icon className="h-[22px] w-[22px]" />
              <span
                className={`font-label text-[10px] uppercase tracking-widest leading-none ${
                  isActive ? "font-bold" : ""
                }`}
              >
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
        <MobileMoreSheet integrationNav={integrationNav} />
      </div>
    </nav>
  );
}

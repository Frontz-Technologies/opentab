"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "dashboard", label: "Dashboard", href: "/dashboard" },
  { icon: "receipt_long", label: "Invoices", href: "/invoices" },
  { icon: "account_balance_wallet", label: "Expenses", href: "/expenses" },
  { icon: "contacts", label: "Contacts", href: "/contacts" },
  { icon: "inventory_2", label: "Products", href: "/products" },
  { icon: "bar_chart", label: "Reports", href: "/reports" },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-dim/90 glass-effect border-t border-on-surface/10">
      <div className="flex items-stretch h-16">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
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
              <span className="material-symbols-outlined text-[22px] leading-none">
                {item.icon}
              </span>
              <span
                className={`font-label text-[10px] uppercase tracking-widest leading-none ${
                  isActive ? "font-bold" : ""
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

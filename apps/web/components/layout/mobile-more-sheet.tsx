"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";

interface IntegrationNavEntry {
  kind: string;
  label: string;
  slug: string;
}

type MoreItem =
  | { icon: string; labelKey: string; href: string }
  | { icon: string; literalLabel: string; href: string };

const baseItems: MoreItem[] = [
  { icon: "undo", labelKey: "creditNotes", href: "/credit-notes" },
  { icon: "request_quote", labelKey: "quotes", href: "/quotes" },
  { icon: "bar_chart", labelKey: "reports", href: "/reports" },
  { icon: "settings", labelKey: "settings", href: "/settings" },
];

interface MobileMoreSheetProps {
  integrationNav?: IntegrationNavEntry[];
}

export function MobileMoreSheet({ integrationNav }: MobileMoreSheetProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  const items: MoreItem[] = [...baseItems];
  if (integrationNav) {
    for (const entry of integrationNav) {
      items.push({
        icon: "cloud_sync",
        literalLabel: entry.label,
        href: `/integrations/${entry.slug}`,
      });
    }
  }

  const isActive = items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
          isActive
            ? "text-primary"
            : "text-on-surface/40 hover:text-on-surface/70"
        }`}
      >
        <span className="material-symbols-outlined text-[22px] leading-none">
          more_horiz
        </span>
        <span
          className={`font-label text-[10px] uppercase tracking-widest leading-none ${
            isActive ? "font-bold" : ""
          }`}
        >
          {t("more")}
        </span>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="bg-surface-container/70 backdrop-blur-[24px] border-t border-outline-variant/15 rounded-t-2xl p-4 pb-8"
      >
        <div className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const label =
              "labelKey" in item ? t(item.labelKey) : item.literalLabel;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  active
                    ? "text-primary bg-surface-container-high/50"
                    : "text-on-surface/60 hover:text-on-surface hover:bg-surface-container-high/30"
                }`}
              >
                <span className="material-symbols-outlined text-[22px] leading-none">
                  {item.icon}
                </span>
                <span className="font-label text-sm">{label}</span>
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

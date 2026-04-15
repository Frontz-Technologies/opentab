"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SettingsNav } from "./settings-nav";

export function SettingsMobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("settingsNav");

  // On /settings index, show only the nav list
  const isIndex = pathname === "/settings";

  if (isIndex) {
    return <SettingsNav />;
  }

  // Determine the current section label
  const sectionLabels: Record<string, string> = {
    "/settings/organisation": t("organisation"),
    "/settings/general": t("general"),
    "/settings/account": t("account"),
    "/settings/appearance": t("appearance"),
    "/settings/integrations": t("integrations"),
  };

  const label =
    Object.entries(sectionLabels).find(([path]) =>
      pathname.startsWith(path),
    )?.[1] ?? t("organisation");

  // On sub-pages, show back button + content (hide the page's own PageHeader)
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/settings"
          className="flex items-center gap-1 text-on-surface/60 hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">
            arrow_back
          </span>
        </Link>
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          {label}
        </h2>
      </div>
      <div className="[&>header]:hidden">{children}</div>
    </div>
  );
}

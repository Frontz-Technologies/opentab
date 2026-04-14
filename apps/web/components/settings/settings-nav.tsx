"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: string;
  labelKey: string;
  subtitleKey: string;
  href: string;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    titleKey: "sectionOrganisation",
    items: [
      {
        icon: "business",
        labelKey: "organisation",
        subtitleKey: "organisationSubtitle",
        href: "/settings/organisation",
      },
    ],
  },
  {
    titleKey: "sectionUser",
    items: [
      {
        icon: "tune",
        labelKey: "general",
        subtitleKey: "generalSubtitle",
        href: "/settings/general",
      },
      {
        icon: "person",
        labelKey: "account",
        subtitleKey: "accountSubtitle",
        href: "/settings/account",
      },
      {
        icon: "palette",
        labelKey: "appearance",
        subtitleKey: "appearanceSubtitle",
        href: "/settings/appearance",
      },
    ],
  },
  {
    titleKey: "sectionIntegrations",
    items: [
      {
        icon: "extension",
        labelKey: "integrations",
        subtitleKey: "integrationsSubtitle",
        href: "/settings/integrations",
      },
    ],
  },
];

const allItems = sections.flatMap((s) => s.items);

export function SettingsNav() {
  const pathname = usePathname();
  const t = useTranslations("settingsNav");

  function isActive(href: string) {
    if (href === "/settings/integrations") {
      return pathname.startsWith("/settings/integrations");
    }
    return pathname === href;
  }

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden md:flex flex-col w-[220px] flex-shrink-0 bg-surface-container rounded-xl p-3 space-y-4 h-fit sticky top-8">
        {sections.map((section) => (
          <div key={section.titleKey}>
            <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant px-3 mb-1.5">
              {t(section.titleKey)}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200",
                        active
                          ? "bg-surface-container-high text-primary font-semibold border-l-2 border-primary"
                          : "text-on-surface/60 hover:text-on-surface hover:bg-surface-container-high/50",
                      )}
                    >
                      <span className="material-symbols-outlined text-[20px] leading-none">
                        {item.icon}
                      </span>
                      <span className="font-label">{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Mobile: iOS-style grouped card list */}
      <nav className="md:hidden space-y-6 px-1">
        {sections.map((section) => (
          <div key={section.titleKey}>
            <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant px-2 mb-2">
              {t(section.titleKey)}
            </p>
            <div className="bg-surface-container rounded-2xl overflow-hidden divide-y divide-outline-variant/10">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-4 transition-colors",
                      active
                        ? "bg-surface-container-high"
                        : "hover:bg-surface-container-high/50",
                    )}
                  >
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant leading-none">
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface">
                        {t(item.labelKey)}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate">
                        {t(item.subtitleKey)}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant leading-none">
                      chevron_right
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

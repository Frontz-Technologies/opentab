"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

interface NavItem {
  icon: string;
  labelKey: string;
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
        href: "/settings/organisation",
      },
    ],
  },
  {
    titleKey: "sectionUser",
    items: [
      { icon: "tune", labelKey: "general", href: "/settings/general" },
      { icon: "person", labelKey: "account", href: "/settings/account" },
      {
        icon: "palette",
        labelKey: "appearance",
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
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                        active
                          ? "bg-surface-container-high text-primary font-semibold border-l-2 border-primary"
                          : "text-on-surface/60 hover:text-on-surface hover:bg-surface-container-high/50"
                      }`}
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

      {/* Mobile: horizontal scrollable pills */}
      <nav className="md:hidden relative">
        <div className="flex gap-2 overflow-x-auto pb-4 px-4 scrollbar-hide">
          {allItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors duration-200 ${
                  active
                    ? "bg-surface-container-high text-primary font-semibold"
                    : "bg-surface-container text-on-surface/60 hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px] leading-none">
                  {item.icon}
                </span>
                <span className="font-label">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
        {/* Right-edge gradient fade scroll affordance */}
        <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-surface-dim to-transparent pointer-events-none" />
      </nav>
    </>
  );
}

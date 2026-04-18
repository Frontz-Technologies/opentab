"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

interface QuickSetupProps {
  completedSteps: string[];
}

const steps = [
  {
    id: "company_info",
    icon: "business",
    labelKey: "companyInfo",
    href: "/settings/company",
    enabled: true,
  },
  {
    id: "vat_number",
    icon: "receipt_long",
    labelKey: "vatNumber",
    href: "/settings/company",
    enabled: true,
  },
  {
    id: "upload_logo",
    icon: "image",
    labelKey: "uploadLogo",
    href: "#",
    enabled: false,
  },
  {
    id: "connect_mydata",
    icon: "cloud_sync",
    labelKey: "connectMydata",
    href: "#",
    enabled: false,
  },
  {
    id: "invite_team",
    icon: "group_add",
    labelKey: "inviteTeam",
    href: "#",
    enabled: false,
  },
];

export function QuickSetup({ completedSteps }: QuickSetupProps) {
  const t = useTranslations("quickSetup");
  const tCommon = useTranslations("common");
  const totalEnabled = steps.filter((s) => s.enabled).length;
  const completedCount = steps.filter(
    (s) => s.enabled && completedSteps.includes(s.id),
  ).length;
  const progress = totalEnabled > 0 ? (completedCount / totalEnabled) * 100 : 0;

  if (completedCount >= totalEnabled) return null;

  return (
    <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-lg text-on-surface">
          {t("title")}
        </h3>
        <span className="font-label text-xs text-on-surface-variant">
          {completedCount}/{totalEnabled} {t("complete")}
        </span>
      </div>
      <div className="w-full h-1.5 bg-surface-container-highest rounded-full mb-6">
        <div
          className="h-full rounded-full btn-gradient transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="space-y-2">
        {steps.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          if (step.enabled) {
            return (
              <Link
                key={step.id}
                href={step.href}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isCompleted ? "bg-primary/5 text-primary" : "hover:bg-surface-container-high text-on-surface"}`}
              >
                <span className="material-symbols-outlined text-xl">
                  {isCompleted ? "check_circle" : step.icon}
                </span>
                <span
                  className={`font-medium text-sm ${isCompleted ? "line-through opacity-60" : ""}`}
                >
                  {t(step.labelKey)}
                </span>
              </Link>
            );
          }
          return (
            <div
              key={step.id}
              className="flex items-center gap-3 p-3 rounded-xl text-on-surface/30"
            >
              <span className="material-symbols-outlined text-xl">
                {step.icon}
              </span>
              <span className="font-medium text-sm">{t(step.labelKey)}</span>
              <span className="ml-auto font-label text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-container-highest/40 text-on-surface-variant">
                {tCommon("comingSoon")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

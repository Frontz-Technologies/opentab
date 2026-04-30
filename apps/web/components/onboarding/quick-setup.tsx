"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Building2,
  Check,
  ChevronRight,
  ImageIcon,
  ReceiptText,
  RefreshCw,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

interface QuickSetupProps {
  completedSteps: string[];
}

interface SetupStep {
  id: string;
  icon: LucideIcon;
  labelKey: string;
  href: string;
  enabled: boolean;
}

const steps: SetupStep[] = [
  {
    id: "company_info",
    icon: Building2,
    labelKey: "companyInfo",
    href: "/settings/company",
    enabled: true,
  },
  {
    id: "vat_number",
    icon: ReceiptText,
    labelKey: "vatNumber",
    href: "/settings/company",
    enabled: true,
  },
  {
    id: "upload_logo",
    icon: ImageIcon,
    labelKey: "uploadLogo",
    href: "#",
    enabled: false,
  },
  {
    id: "connect_mydata",
    icon: RefreshCw,
    labelKey: "connectMydata",
    href: "#",
    enabled: false,
  },
  {
    id: "invite_team",
    icon: UserPlus,
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
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="font-headline font-bold text-lg text-on-surface min-w-0">
          {t("title")}
        </h3>
        <span className="font-label text-xs text-on-surface-variant shrink-0 whitespace-nowrap">
          {completedCount}/{totalEnabled} {t("complete")}
        </span>
      </div>
      <div className="w-full h-1.5 bg-surface-container-highest rounded-full mb-6">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="-mx-2 divide-y divide-outline-variant/10">
        {steps.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          if (step.enabled) {
            return (
              <Link
                key={step.id}
                href={step.href}
                className="group flex items-center gap-3 px-2 py-2.5 transition-colors hover:bg-surface-container-high rounded-lg"
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                    isCompleted
                      ? "bg-primary text-on-primary"
                      : "border border-outline-variant/30 bg-surface-container-low group-hover:border-primary/50"
                  }`}
                  aria-hidden
                >
                  {isCompleted && <Check className="h-3.5 w-3.5" />}
                </span>
                {(() => {
                  const Icon = step.icon;
                  return (
                    <Icon className="h-[18px] w-[18px] text-on-surface-variant shrink-0" />
                  );
                })()}
                <span
                  className={`font-medium text-sm min-w-0 flex-1 ${
                    isCompleted
                      ? "line-through text-on-surface/50"
                      : "text-on-surface"
                  }`}
                >
                  {t(step.labelKey)}
                </span>
                <ChevronRight
                  className="h-[18px] w-[18px] text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100 shrink-0"
                  aria-hidden
                />
              </Link>
            );
          }
          return (
            <div
              key={step.id}
              className="flex items-center gap-3 px-2 py-2.5 opacity-50"
            >
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-low"
                aria-hidden
              />
              {(() => {
                const Icon = step.icon;
                return (
                  <Icon className="h-[18px] w-[18px] text-on-surface-variant shrink-0" />
                );
              })()}
              <span className="font-medium text-sm text-on-surface/70 min-w-0 flex-1">
                {t(step.labelKey)}
              </span>
              <span className="font-label text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-surface-container-highest/40 text-on-surface-variant shrink-0 whitespace-nowrap">
                {tCommon("soonBadge")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

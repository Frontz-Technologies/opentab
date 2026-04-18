"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/settings/settings-section";
import { updateAppearanceSettings } from "./actions";

interface AppearanceFormProps {
  initialData: {
    theme: string;
    density: string;
  };
}

function ThemeCard({
  name,
  label,
  selected,
  disabled,
  comingSoonLabel,
  onSelect,
}: {
  name: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  comingSoonLabel?: string;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(name)}
      disabled={disabled}
      className={`relative flex flex-col items-center gap-2 p-5 rounded-xl transition-colors duration-200 ${
        selected
          ? "bg-surface-bright"
          : disabled
            ? "bg-surface-container opacity-60 cursor-not-allowed"
            : "bg-surface-container hover:bg-surface-container-high cursor-pointer"
      }`}
    >
      {disabled && comingSoonLabel && (
        <span className="absolute top-2 right-2 font-label text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-container-highest/40 text-on-surface-variant">
          {comingSoonLabel}
        </span>
      )}
      <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
        {name === "dark"
          ? "dark_mode"
          : name === "light"
            ? "light_mode"
            : "contrast"}
      </span>
      <span className="font-label text-sm text-on-surface">{label}</span>
    </button>
  );
}

function DensityCard({
  name,
  label,
  description,
  selected,
  gapClass,
  paddingClass,
  onSelect,
}: {
  name: string;
  label: string;
  description: string;
  selected: boolean;
  gapClass: string;
  paddingClass: string;
  onSelect: (name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(name)}
      className={`flex flex-col gap-3 p-5 rounded-xl transition-colors duration-200 text-left ${
        selected
          ? "bg-surface-bright"
          : "bg-surface-container hover:bg-surface-container-high cursor-pointer"
      }`}
    >
      <div>
        <p className="font-label text-sm font-semibold text-on-surface">
          {label}
        </p>
        <p className="text-xs text-on-surface-variant">{description}</p>
      </div>
      {/* Mini schematic preview */}
      <div className={`flex flex-col ${gapClass} w-full max-w-[120px]`}>
        <div
          className={`${paddingClass} rounded bg-surface-container-highest h-3`}
        />
        <div
          className={`${paddingClass} rounded bg-surface-container-highest h-3 w-4/5`}
        />
        <div
          className={`${paddingClass} rounded bg-surface-container-highest h-3 w-3/5`}
        />
      </div>
    </button>
  );
}

export function AppearanceForm({ initialData }: AppearanceFormProps) {
  const t = useTranslations("settingsAppearance");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [theme, setTheme] = useState(initialData.theme);
  const [density, setDensity] = useState(initialData.density);
  const [toast, setToast] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateAppearanceSettings(formData);
      setToast(t("saved"));
      setTimeout(() => setToast(null), 4000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <input type="hidden" name="theme" value={theme} />
      <input type="hidden" name="density" value={density} />

      {toast && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium bg-primary/10 text-primary">
          {toast}
        </div>
      )}

      <SettingsSection title={t("theme")}>
        <div className="grid grid-cols-3 gap-3">
          <ThemeCard
            name="dark"
            label={t("themeDark")}
            selected={theme === "dark"}
            onSelect={setTheme}
          />
          <ThemeCard
            name="light"
            label={t("themeLight")}
            selected={theme === "light"}
            disabled
            comingSoonLabel={tCommon("comingSoon")}
            onSelect={setTheme}
          />
          <ThemeCard
            name="system"
            label={t("themeSystem")}
            selected={theme === "system"}
            disabled
            comingSoonLabel={tCommon("comingSoon")}
            onSelect={setTheme}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t("density")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DensityCard
            name="comfortable"
            label={t("densityComfortable")}
            description={t("densityComfortableDesc")}
            selected={density === "comfortable"}
            gapClass="gap-2.5"
            paddingClass="px-3"
            onSelect={setDensity}
          />
          <DensityCard
            name="compact"
            label={t("densityCompact")}
            description={t("densityCompactDesc")}
            selected={density === "compact"}
            gapClass="gap-1"
            paddingClass="px-2"
            onSelect={setDensity}
          />
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="h-12 px-8 rounded-xl btn-gradient text-on-primary font-bold text-sm transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : tCommon("save")}
        </button>
      </div>
    </form>
  );
}

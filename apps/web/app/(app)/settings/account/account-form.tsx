"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/settings/settings-section";
import { updateProfile, changePassword } from "./actions";

const inputClass =
  "w-full bg-surface-container-lowest border-none rounded-xl px-4 h-12 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:bg-surface-container-high transition-colors";

interface AccountFormProps {
  initialData: {
    name: string;
    email: string;
  };
}

export function AccountForm({ initialData }: AccountFormProps) {
  const t = useTranslations("settingsAccount");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateProfile(formData);
        showToast("success", t("profileSaved"));
      } catch {
        showToast("error", "Failed to update profile");
      }
    });
  }

  function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await changePassword(formData);
      if (result.success) {
        showToast("success", t("passwordChanged"));
        (e.target as HTMLFormElement).reset();
      } else {
        showToast("error", t(result.error ?? "wrongPassword"));
      }
    });
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium ${
            toast.type === "success"
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleProfileSubmit} className="space-y-8">
        <SettingsSection title={t("profile")}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block font-medium text-sm text-on-surface">
                {t("name")}
              </label>
              <input
                type="text"
                name="name"
                className={inputClass}
                defaultValue={initialData.name}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-medium text-sm text-on-surface">
                {t("email")}
              </label>
              <input
                type="email"
                name="email"
                className={inputClass}
                defaultValue={initialData.email}
                disabled
              />
              <p className="text-xs text-on-surface-variant/70">
                {t("emailHint")}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <label className="block font-medium text-sm text-on-surface mb-1.5">
              {t("avatar")}
            </label>
            <div className="flex flex-col items-center justify-center min-h-[100px] rounded-xl bg-surface-container-lowest text-on-surface/30 gap-2">
              <span className="material-symbols-outlined text-3xl">
                account_circle
              </span>
              <p className="text-sm font-medium">{t("avatarPlaceholder")}</p>
            </div>
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

      <form onSubmit={handlePasswordSubmit} className="space-y-8">
        <SettingsSection title={t("security")}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block font-medium text-sm text-on-surface">
                {t("currentPassword")}
              </label>
              <input
                type="password"
                name="currentPassword"
                className={inputClass}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-medium text-sm text-on-surface">
                {t("newPassword")}
              </label>
              <input
                type="password"
                name="newPassword"
                className={inputClass}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block font-medium text-sm text-on-surface">
                {t("confirmPassword")}
              </label>
              <input
                type="password"
                name="confirmPassword"
                className={inputClass}
                required
              />
            </div>
          </div>
        </SettingsSection>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="h-12 px-8 rounded-xl bg-surface-container-high text-on-surface font-bold text-sm hover:bg-surface-container-highest transition-colors active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : t("changePassword")}
          </button>
        </div>
      </form>
    </div>
  );
}

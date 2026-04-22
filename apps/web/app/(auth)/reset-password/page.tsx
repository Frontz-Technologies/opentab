"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/auth/form-error";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth");
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    if (!token) {
      setError(t("invalidLinkInline"));
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        setError(result.error.message ?? t("resetFailed"));
      } else {
        router.push("/login");
      }
    } catch {
      setError(t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="bg-surface-container-low rounded-2xl p-8">
        {/* Mobile logo — hidden on desktop */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-lg">
              account_balance
            </span>
          </div>
          <span className="font-headline text-xl font-bold text-on-surface">
            OpenTab
          </span>
        </div>
        <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">
          {t("invalidLinkTitle")}
        </h1>
        <p className="text-on-surface-variant mb-6">{t("invalidLinkBody")}</p>
        <Link
          href="/forgot-password"
          className="text-primary hover:text-primary-container transition-colors text-sm font-medium"
        >
          {t("requestNewLink")} →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low rounded-2xl p-8">
      {/* Mobile logo — hidden on desktop */}
      <div className="flex lg:hidden items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary text-lg">
            account_balance
          </span>
        </div>
        <span className="font-headline text-xl font-bold text-on-surface">
          OpenTab
        </span>
      </div>

      <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">
        {t("resetTitle")}
      </h1>
      <p className="text-on-surface-variant mb-8">{t("resetDescription")}</p>

      <FormError message={error} />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-on-surface-variant">
            {t("resetNewLabel")}
          </Label>
          <Input
            id="password"
            type="password"
            placeholder={t("passwordAtLeast8")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-surface-container-lowest border-none focus:bg-surface-container-high transition-colors h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-on-surface-variant">
            {t("resetConfirmLabel")}
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="bg-surface-container-lowest border-none focus:bg-surface-container-high transition-colors h-12"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !password.trim() || !confirmPassword.trim()}
          className="w-full h-12 bg-primary text-on-primary font-bold text-base border-none hover:opacity-90"
        >
          {loading ? t("updating") : t("updatePassword")}
        </Button>
      </form>

      <p className="mt-6 text-center text-on-surface-variant text-sm">
        <Link
          href="/login"
          className="text-primary hover:text-primary-container transition-colors font-medium"
        >
          ← {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-surface-container-low rounded-2xl p-8 flex items-center justify-center h-48">
          <span className="material-symbols-outlined text-on-surface-variant animate-spin">
            progress_activity
          </span>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

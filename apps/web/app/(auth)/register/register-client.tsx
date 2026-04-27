"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/auth/form-error";

interface RegisterClientProps {
  // Both URLs are required for the legal-consent text to render
  // ("By creating an account you agree to our Terms and Privacy Policy"
  // is meaningless if either link is broken). The server resolves these
  // from LEGAL_TERMS_URL / LEGAL_PRIVACY_URL and passes null when
  // either is unset.
  termsUrl: string | null;
  privacyUrl: string | null;
  legalFooter?: ReactNode;
}

export function RegisterClient({
  termsUrl,
  privacyUrl,
  legalFooter,
}: RegisterClientProps) {
  const router = useRouter();
  const t = useTranslations("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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

    setLoading(true);

    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message ?? t("signUpFailed"));
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError(t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
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
        {t("createYourAccount")}
      </h1>
      <p className="text-on-surface-variant mb-8">{t("registerSubtitle")}</p>

      <FormError message={error} />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-on-surface-variant">
            {t("name")}
          </Label>
          <Input
            id="name"
            type="text"
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-surface-container-lowest border-none focus:bg-surface-container-high transition-colors h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-on-surface-variant">
            {t("email")}
          </Label>
          <Input
            id="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-surface-container-lowest border-none focus:bg-surface-container-high transition-colors h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-on-surface-variant">
            {t("password")}
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
            {t("confirmPassword")}
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

        {termsUrl && privacyUrl && (
          <p className="text-xs text-on-surface-variant/60 text-center">
            {t.rich("legalConsent", {
              terms: (chunks) => (
                <a
                  href={termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary-container transition-colors"
                >
                  {chunks}
                </a>
              ),
              privacy: (chunks) => (
                <a
                  href={privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary-container transition-colors"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        )}

        <Button
          type="submit"
          disabled={
            loading ||
            !name.trim() ||
            !email.trim() ||
            !password.trim() ||
            !confirmPassword.trim()
          }
          className="w-full h-12 bg-primary text-on-primary font-bold text-base border-none hover:opacity-90"
        >
          {loading ? t("creatingAccount") : t("register")}
        </Button>
      </form>

      <p className="mt-6 text-center text-on-surface-variant text-sm">
        {t("hasAccount")}{" "}
        <Link
          href="/login"
          className="text-primary hover:text-primary-container transition-colors font-medium"
        >
          {t("login")}
        </Link>
      </p>

      {legalFooter}
    </div>
  );
}

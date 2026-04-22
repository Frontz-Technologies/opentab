"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/auth/form-error";
import { getDemoCredentialsAction } from "./actions";

const DEMO_ENABLED =
  process.env.NEXT_PUBLIC_DEMO_SAMPLE_DATA_ENABLED === "true";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tDemo = useTranslations("demo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? t("invalidCredentials"));
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError(t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  async function handleTryDemo() {
    setError("");
    setDemoLoading(true);
    try {
      const result = await getDemoCredentialsAction();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEmail(result.email);
      setPassword(result.password);
      const signInResult = await signIn.email({
        email: result.email,
        password: result.password,
      });
      if (signInResult.error) {
        setError(signInResult.error.message ?? t("invalidCredentials"));
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError(t("somethingWentWrong"));
    } finally {
      setDemoLoading(false);
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
        {t("welcomeBack")}
      </h1>
      <p className="text-on-surface-variant mb-8">{t("loginSubtitle")}</p>

      <FormError message={error} />

      {DEMO_ENABLED && (
        <div
          data-testid="login-demo-card"
          className="mb-6 rounded-xl border border-primary/30 bg-primary-container/10 p-4"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-primary text-[22px] leading-none mt-0.5"
            >
              auto_awesome
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-on-surface">
                {tDemo("loginCardTitle")}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                {tDemo("loginCardBody")}
              </p>
              <Button
                type="button"
                onClick={handleTryDemo}
                disabled={demoLoading || loading}
                className="mt-3 h-9 px-4 text-sm"
              >
                {demoLoading
                  ? tDemo("loginCardLoading")
                  : tDemo("loginCardAction")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-on-surface-variant">
              {t("password")}
            </Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:text-primary-container transition-colors"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-surface-container-lowest border-none focus:bg-surface-container-high transition-colors h-12"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !email.trim() || !password.trim()}
          className="w-full h-12 bg-primary text-on-primary font-bold text-base border-none hover:opacity-90"
        >
          {loading ? t("signingIn") : t("login")}
        </Button>
      </form>

      <p className="mt-6 text-center text-on-surface-variant text-sm">
        {t("noAccount")}{" "}
        <Link
          href="/register"
          className="text-primary hover:text-primary-container transition-colors font-medium"
        >
          {t("register")}
        </Link>
      </p>

      <p className="mt-4 text-center text-on-surface-variant/60 text-xs">
        <a
          href="https://opentab.tech/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-on-surface-variant transition-colors"
        >
          {t("terms")}
        </a>
        {" · "}
        <a
          href="https://opentab.tech/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-on-surface-variant transition-colors"
        >
          {t("privacy")}
        </a>
      </p>
    </div>
  );
}

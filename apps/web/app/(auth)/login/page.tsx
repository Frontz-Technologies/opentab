"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Invalid email or password.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Mobile logo — hidden on desktop */}
      <div className="flex lg:hidden items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4EDEA3] to-[#10b981] flex items-center justify-center">
          <span className="material-symbols-outlined text-[#131313] text-lg">account_balance</span>
        </div>
        <span className="font-headline text-xl font-bold text-on-surface">OpenTab</span>
      </div>

      <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">{t("welcomeBack")}</h1>
      <p className="text-on-surface-variant mb-8">Sign in to your account to continue.</p>

      {error && (
        <div className="p-4 rounded-xl bg-error-container/20 text-tertiary-container text-sm mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-on-surface-variant">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-surface-container-lowest border-none focus:bg-surface-container-high transition-colors h-12"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-on-surface-variant">{t("password")}</Label>
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
          disabled={loading}
          className="w-full h-12 btn-gradient text-on-primary font-bold text-base border-none hover:opacity-90"
        >
          {loading ? "Signing in…" : t("login")}
        </Button>
      </form>

      <p className="mt-6 text-center text-on-surface-variant text-sm">
        {t("noAccount")}{" "}
        <Link href="/register" className="text-primary hover:text-primary-container transition-colors font-medium">
          {t("register")}
        </Link>
      </p>
    </div>
  );
}

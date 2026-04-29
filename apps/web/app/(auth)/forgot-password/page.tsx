"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Landmark, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3000");
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${origin}/reset-password`,
      });
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="bg-surface-container-low rounded-2xl p-8">
      {/* Mobile logo — hidden on desktop */}
      <div className="flex lg:hidden items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
          <Landmark className="h-5 w-5 text-on-primary" />
        </div>
        <span className="font-headline text-xl font-bold text-on-surface">
          OpenTab
        </span>
      </div>

      {submitted ? (
        <div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">
            {t("forgotSuccessTitle")}
          </h1>
          <p className="text-on-surface-variant mb-8 leading-relaxed">
            {t.rich("forgotSuccessBody", {
              email: () => (
                <span className="text-on-surface font-medium">{email}</span>
              ),
            })}
          </p>
          <Link
            href="/login"
            className="text-primary hover:text-primary-container transition-colors text-sm font-medium"
          >
            ← {t("backToSignIn")}
          </Link>
        </div>
      ) : (
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">
            {t("forgotTitle")}
          </h1>
          <p className="text-on-surface-variant mb-8">
            {t("forgotDescription")}
          </p>

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

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-on-primary font-bold text-base border-none hover:opacity-90"
            >
              {loading ? t("sending") : t("sendResetLink")}
            </Button>
          </form>

          <p className="mt-6 text-center text-on-surface-variant text-sm">
            {t("rememberedIt")}{" "}
            <Link
              href="/login"
              className="text-primary hover:text-primary-container transition-colors font-medium"
            >
              {t("login")}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

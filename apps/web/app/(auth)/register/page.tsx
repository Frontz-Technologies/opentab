"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
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
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message ?? "Failed to create account.");
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
          <span className="material-symbols-outlined text-[#131313] text-lg">
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
      <p className="text-on-surface-variant mb-8">
        Get started with OpenTab for free.
      </p>

      {error && (
        <div className="p-4 rounded-xl bg-error-container/20 text-tertiary-container text-sm mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-on-surface-variant">
            {t("name")}
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Jane Smith"
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
            placeholder="you@example.com"
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
            placeholder="At least 8 characters"
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

        <p className="text-xs text-on-surface-variant/60 text-center">
          By creating an account you agree to our{" "}
          <a
            href="https://opentab.tech/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-container transition-colors"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="https://opentab.tech/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-container transition-colors"
          >
            Privacy Policy
          </a>
          .
        </p>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 btn-gradient text-on-primary font-bold text-base border-none hover:opacity-90"
        >
          {loading ? "Creating account…" : t("register")}
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
    </div>
  );
}

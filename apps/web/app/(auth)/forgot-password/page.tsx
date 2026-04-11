"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password`,
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
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4EDEA3] to-[#10b981] flex items-center justify-center">
          <span className="material-symbols-outlined text-[#131313] text-lg">account_balance</span>
        </div>
        <span className="font-headline text-xl font-bold text-on-surface">OpenTab</span>
      </div>

      {submitted ? (
        <div>
          <div className="w-12 h-12 rounded-full bg-[#4EDEA3]/10 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[#4EDEA3] text-2xl">mark_email_read</span>
          </div>
          <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Check your email</h1>
          <p className="text-on-surface-variant mb-8 leading-relaxed">
            If an account exists for <span className="text-on-surface font-medium">{email}</span>, we&apos;ve sent a password reset link. Check your inbox and spam folder.
          </p>
          <Link
            href="/login"
            className="text-primary hover:text-primary-container transition-colors text-sm font-medium"
          >
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Reset password</h1>
          <p className="text-on-surface-variant mb-8">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-on-surface-variant">Email</Label>
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

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 btn-gradient text-on-primary font-bold text-base border-none hover:opacity-90"
            >
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>

          <p className="mt-6 text-center text-on-surface-variant text-sm">
            Remembered it?{" "}
            <Link href="/login" className="text-primary hover:text-primary-container transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

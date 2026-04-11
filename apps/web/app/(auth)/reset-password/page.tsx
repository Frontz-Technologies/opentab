"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

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

    if (!token) {
      setError("Invalid or expired reset link. Please request a new one.");
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(result.error.message ?? "Failed to reset password. The link may have expired.");
      } else {
        router.push("/login");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="bg-surface-container-low rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4EDEA3] to-[#10b981] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#131313] text-lg">account_balance</span>
          </div>
          <span className="font-headline text-xl font-bold text-on-surface">OpenTab</span>
        </div>
        <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Invalid link</h1>
        <p className="text-on-surface-variant mb-6">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="text-primary hover:text-primary-container transition-colors text-sm font-medium"
        >
          Request a new reset link →
        </Link>
      </div>
    );
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

      <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Set new password</h1>
      <p className="text-on-surface-variant mb-8">Choose a strong password for your account.</p>

      {error && (
        <div className="p-4 rounded-xl bg-error-container/20 text-tertiary-container text-sm mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-on-surface-variant">New password</Label>
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
          <Label htmlFor="confirmPassword" className="text-on-surface-variant">Confirm new password</Label>
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
          disabled={loading}
          className="w-full h-12 btn-gradient text-on-primary font-bold text-base border-none hover:opacity-90"
        >
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-on-surface-variant text-sm">
        <Link href="/login" className="text-primary hover:text-primary-container transition-colors font-medium">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="bg-surface-container-low rounded-2xl p-8 flex items-center justify-center h-48">
        <span className="material-symbols-outlined text-on-surface-variant animate-spin">progress_activity</span>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

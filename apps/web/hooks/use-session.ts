"use client";

import { useSession as useBetterAuthSession } from "@/lib/auth-client";

export function useAppSession() {
  const { data: session, isPending, error } = useBetterAuthSession();
  return {
    user: session?.user ?? null,
    session: session?.session ?? null,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
    error,
  };
}

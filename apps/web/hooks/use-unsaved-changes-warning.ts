"use client";

import { useEffect } from "react";

/**
 * Warns the user when they try to leave a page with unsaved changes.
 * Handles both browser navigation (close/refresh) and client-side
 * navigation (back button, link clicks via Next.js router).
 *
 * @param isDirty - Whether the form has unsaved data
 * @param message - Confirmation message shown on client-side navigation
 */
export function useUnsavedChangesWarning(isDirty: boolean, message: string) {
  // Browser close/refresh
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Back/forward button (popstate)
  useEffect(() => {
    if (!isDirty) return;

    const handlePopState = () => {
      if (!window.confirm(message)) {
        window.history.pushState(null, "", window.location.href);
      }
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isDirty, message]);

  // Intercept client-side link clicks (Next.js <Link> and sidebar navigation)
  useEffect(() => {
    if (!isDirty) return;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#")) return;

      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isDirty, message]);
}

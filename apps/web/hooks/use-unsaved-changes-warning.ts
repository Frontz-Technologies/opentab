"use client";

import { useEffect, useRef } from "react";

/**
 * Warns the user when they try to leave a page with unsaved changes.
 * Handles both browser navigation (close/refresh) and client-side
 * navigation (back button, link clicks via Next.js router).
 *
 * @param isDirty - Whether the form has unsaved data
 * @param message - Confirmation message shown on client-side navigation
 */
export function useUnsavedChangesWarning(isDirty: boolean, message: string) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    if (!isDirty) return;

    // Browser close/refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    // Back/forward button (popstate)
    const handlePopState = () => {
      if (isDirtyRef.current && !window.confirm(message)) {
        // Push the current URL back to cancel the navigation
        window.history.pushState(null, "", window.location.href);
      }
    };

    // Push a state entry so we can catch the back button
    window.history.pushState(null, "", window.location.href);

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty, message]);

  // Intercept client-side link clicks (Next.js <Link> and sidebar navigation)
  useEffect(() => {
    if (!isDirty) return;

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#")) return;

      // This is an internal navigation link
      if (isDirtyRef.current && !window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isDirty, message]);
}

"use client";

import { useSyncExternalStore } from "react";

export interface ChartTheme {
  revenue: string;
  expense: string;
  primary: string;
  grid: string;
  tickText: string;
  series: string[];
}

const DARK: ChartTheme = {
  revenue: "#4EDEA3",
  expense: "#FC7C78",
  primary: "#4EDEA3",
  grid: "rgba(255,255,255,0.06)",
  tickText: "rgba(255,255,255,0.5)",
  series: [
    "#4EDEA3",
    "#60A5FA",
    "#FBBF24",
    "#A78BFA",
    "#FB7185",
    "#2DD4BF",
    "#FB923C",
    "#94A3B8",
  ],
};

const LIGHT: ChartTheme = {
  revenue: "#087055",
  expense: "#B3261E",
  primary: "#087055",
  grid: "rgba(0,0,0,0.06)",
  tickText: "rgba(0,0,0,0.55)",
  series: [
    "#087055",
    "#2563EB",
    "#D97706",
    "#7C3AED",
    "#DC2626",
    "#0D9488",
    "#EA580C",
    "#475569",
  ],
};

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): ChartTheme {
  return document.documentElement.classList.contains("dark") ? DARK : LIGHT;
}

function getServerSnapshot(): ChartTheme {
  return DARK;
}

/**
 * Returns a palette that adapts to the current theme (reads the `dark`
 * class on <html> and re-reads when it toggles). Recharts doesn't resolve
 * CSS custom properties, so charts need concrete hex values.
 *
 * Uses useSyncExternalStore so the server snapshot (DARK) matches the
 * first client render and there's no hydration mismatch. After hydration
 * the subscription kicks in and the theme flips if the user is actually
 * in light mode — a single re-paint, no hydration error.
 */
export function useChartTheme(): ChartTheme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

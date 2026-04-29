"use client";

import {
  AlertTriangle,
  Calendar,
  HelpCircle,
  Hourglass,
  Landmark,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  User,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/logging/logger";

// Explicit allow-list of icons referenced by data structures that cross
// the Server Component → Client Component boundary. RSC payloads cannot
// carry component references, so producers emit string identifiers and
// this lookup resolves them client-side. Keep entries alphabetised.
//
// When a new server-built insight/card needs an icon, add it here and use
// the same string identifier in the producer.
const ICONS: Record<string, LucideIcon> = {
  AlertTriangle,
  Calendar,
  Hourglass,
  Landmark,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  User,
};

const log = createLogger("icons");

interface IconByNameProps {
  name: string;
  className?: string;
}

/**
 * Renders a lucide-react icon by its export name. Used by Client Components
 * that receive a string icon identifier from a Server Component (RSC payloads
 * cannot carry React component references across the boundary).
 *
 * Unknown names render a visible `<HelpCircle>` placeholder (red) and emit a
 * dev-only warning so the gap is detectable in the UI without needing to open
 * the console.
 */
export function IconByName({ name, className }: IconByNameProps) {
  const Icon = ICONS[name];
  if (!Icon) {
    if (process.env.NODE_ENV !== "production") {
      log.warn("no lucide icon registered", { name });
    }
    return (
      <HelpCircle
        data-icon-missing={name}
        className={cn("h-5 w-5 text-destructive", className)}
        aria-label={`Missing icon: ${name}`}
      />
    );
  }
  return <Icon className={cn("h-5 w-5", className)} />;
}

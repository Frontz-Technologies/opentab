"use client";

import {
  AlertTriangle,
  Calendar,
  Hourglass,
  Landmark,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  User,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

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

interface IconByNameProps {
  name: string;
  className?: string;
}

/**
 * Renders a lucide-react icon by its export name. Used by Client Components
 * that receive a string icon identifier from a Server Component (RSC payloads
 * cannot carry React component references across the boundary).
 */
export function IconByName({ name, className }: IconByNameProps) {
  const Icon = ICONS[name];
  if (!Icon) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[icons] no lucide icon registered for "${name}"`);
    }
    return null;
  }
  return <Icon className={cn("h-5 w-5", className)} />;
}

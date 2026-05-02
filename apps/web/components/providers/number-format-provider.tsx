"use client";

import { createContext, useContext } from "react";
import { NUMBER_FORMATS, type NumberFormat } from "@/lib/validation/money";

const Ctx = createContext<NumberFormat>("eu");

function isValid(v: unknown): v is NumberFormat {
  return (
    typeof v === "string" && (NUMBER_FORMATS as readonly string[]).includes(v)
  );
}

export function NumberFormatProvider({
  value,
  children,
}: {
  value: NumberFormat | string | undefined;
  children: React.ReactNode;
}) {
  // Be liberal: an invalid stored value (e.g. older row from before fr
  // existed, or a legacy "european"/"american" string) falls back to eu
  // rather than crashing the form.
  const safe: NumberFormat = isValid(value) ? value : "eu";
  return <Ctx.Provider value={safe}>{children}</Ctx.Provider>;
}

export function useNumberFormat(): NumberFormat {
  return useContext(Ctx);
}

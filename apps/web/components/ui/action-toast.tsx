"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function useActionToast(
  result: {
    success: boolean;
    error?: string | Record<string, string[]>;
  } | null,
  successMessage?: string,
) {
  useEffect(() => {
    if (!result) return;
    if (result.success) {
      if (successMessage) toast.success(successMessage);
    } else if (result.error) {
      if (typeof result.error === "string") {
        toast.error(result.error);
      } else {
        const messages = Object.values(result.error).flat().join(". ");
        toast.error(messages || "Something went wrong");
      }
    }
  }, [result, successMessage]);
}

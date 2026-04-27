"use client";

import { cn } from "@/lib/utils";

interface WizardStepperProps {
  steps: { id: string; label: string }[];
  currentId: string;
}

export function WizardStepper({ steps, currentId }: WizardStepperProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentId);
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const active = i === currentIndex;
        const done = i < currentIndex;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-primary text-on-primary",
                active &&
                  "bg-primary-container text-on-primary-container ring-2 ring-primary",
                !active && !done && "bg-surface-container text-on-surface/50",
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "font-label",
                active ? "text-on-surface" : "text-on-surface/60",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="w-6 h-px bg-on-surface/20 mx-1" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

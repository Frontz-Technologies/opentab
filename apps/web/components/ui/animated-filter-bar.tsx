"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useId } from "react";

interface FilterItem<T extends string = string> {
  value: T;
  label: string;
  /** When set, the item renders as a `<Link>` instead of a `<button>`. */
  href?: string;
  /** When true, the item renders disabled (no link / button). */
  disabled?: boolean;
}

interface AnimatedFilterBarProps<T extends string = string> {
  items: FilterItem<T>[];
  value: T;
  onValueChange?: (value: T) => void;
  className?: string;
}

export function AnimatedFilterBar<T extends string = string>({
  items,
  value,
  onValueChange,
  className,
}: AnimatedFilterBarProps<T>) {
  const layoutId = useId();

  return (
    <div
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-full bg-surface-container p-1 overflow-x-auto max-w-full whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = value === item.value;
        const baseClasses = cn(
          "relative shrink-0 rounded-full px-3 py-1.5 font-label text-sm transition-colors duration-200 whitespace-nowrap",
          item.disabled
            ? "text-on-surface/30 cursor-not-allowed pointer-events-none"
            : isActive
              ? "text-on-surface"
              : "text-on-surface-variant hover:text-on-surface/80",
        );

        const activeIndicator = isActive ? (
          <motion.div
            layoutId={`filter-indicator-${layoutId}`}
            className="absolute inset-0 rounded-full bg-surface-container-high shadow-sm"
            style={{ zIndex: 0 }}
            initial={false}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        ) : null;
        const labelSpan = (
          <span className="relative z-10 inline-flex items-center gap-1.5">
            {item.label}
            {item.disabled && (
              <Lock className="h-3 w-3 opacity-70" aria-hidden="true" />
            )}
          </span>
        );

        if (item.href && !item.disabled) {
          return (
            <Link
              key={item.value}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(baseClasses, "cursor-pointer")}
            >
              {activeIndicator}
              {labelSpan}
            </Link>
          );
        }

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={isActive}
            disabled={item.disabled}
            onClick={
              onValueChange && !item.disabled
                ? () => onValueChange(item.value)
                : undefined
            }
            className={cn(baseClasses, !item.disabled && "cursor-pointer")}
          >
            {activeIndicator}
            {labelSpan}
          </button>
        );
      })}
    </div>
  );
}

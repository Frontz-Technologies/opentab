"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useId } from "react";

interface FilterItem<T extends string = string> {
  value: T;
  label: string;
}

interface AnimatedFilterBarProps<T extends string = string> {
  items: FilterItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
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
        "inline-flex items-center gap-0.5 rounded-full bg-surface-container p-1",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onValueChange(item.value)}
            className={cn(
              "relative cursor-pointer rounded-full px-3 py-1.5 font-label text-sm transition-colors duration-200",
              isActive
                ? "text-on-surface"
                : "text-on-surface-variant hover:text-on-surface/80",
            )}
          >
            {isActive && (
              <motion.div
                layoutId={`filter-indicator-${layoutId}`}
                className="absolute inset-0 rounded-full bg-surface-container-high shadow-sm"
                style={{ zIndex: 0 }}
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

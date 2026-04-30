import Link from "next/link";
import { Plus } from "lucide-react";

interface EmptyEntityHintProps {
  /** Localised message — e.g. "No clients yet". */
  message: string;
  /** Localised CTA label — e.g. "New client". */
  ctaLabel: string;
  /**
   * Where the CTA points. Either a navigation href OR an onClick (e.g.
   * to open a create-dialog inline). When both are provided onClick wins.
   */
  ctaHref?: string;
  ctaOnClick?: () => void;
}

/**
 * Stand-in for a Select component when the entity list is empty.
 * Replaces the disabled trigger with a tonal info row + inline CTA so
 * the user can immediately create the missing record. Use ctaOnClick
 * for forms with an inline create-dialog (so the in-progress form
 * state isn't lost to a route change).
 */
export function EmptyEntityHint({
  message,
  ctaLabel,
  ctaHref,
  ctaOnClick,
}: EmptyEntityHintProps) {
  const buttonClass =
    "inline-flex shrink-0 items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/80 transition-colors";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
      <span className="min-w-0 truncate">{message}</span>
      {ctaOnClick ? (
        <button type="button" onClick={ctaOnClick} className={buttonClass}>
          <Plus className="h-[18px] w-[18px]" />
          {ctaLabel}
        </button>
      ) : ctaHref ? (
        <Link href={ctaHref} className={buttonClass}>
          <Plus className="h-[18px] w-[18px]" />
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

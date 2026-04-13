import type { BracketBreakdown } from "@/lib/reports/tax/types";
import type { EntityType } from "@/lib/reports/tax/types";

function formatEur(n: number): string {
  return `\u20AC${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TaxBracketTable({
  breakdown,
  entityType,
}: {
  breakdown: BracketBreakdown[];
  entityType: EntityType;
}) {
  const isCorporate = entityType !== "freelancer";

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-on-surface-variant text-xs uppercase tracking-widest border-b border-outline-variant/10">
          {!isCorporate && <th className="text-left py-2">From</th>}
          {!isCorporate && <th className="text-left py-2">To</th>}
          <th className="text-left py-2">Rate</th>
          <th className="text-right py-2">Tax Amount</th>
        </tr>
      </thead>
      <tbody>
        {breakdown.map((b, i) => (
          <tr key={i} className="border-b border-outline-variant/5">
            {!isCorporate && (
              <td className="py-2 font-mono text-on-surface">
                {formatEur(b.from)}
              </td>
            )}
            {!isCorporate && (
              <td className="py-2 font-mono text-on-surface">
                {b.to === Infinity ? "\u221E" : formatEur(b.to)}
              </td>
            )}
            <td className="py-2 font-mono text-on-surface">
              {(b.rate * 100).toFixed(0)}%
            </td>
            <td className="py-2 text-right font-mono text-on-surface">
              {formatEur(b.taxAmount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

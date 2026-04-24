import { redirect } from "next/navigation";

// Landing page → P&L. Reports UX is tab-driven from each sub-page
// (see reports-tabs.tsx); the empty "choose a report card grid" was
// replaced per #200. Deep-links to /reports/vat and /reports/tax-
// projection still work directly; /reports by itself always lands on
// the default report.
export default function ReportsLandingPage() {
  redirect("/reports/pnl");
}

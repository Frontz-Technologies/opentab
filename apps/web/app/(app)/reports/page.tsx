import { redirect } from "next/navigation";

// Landing page → P&L. Reports UX is tab-driven from each sub-page
// (see reports-tabs.tsx). Deep-links to /reports/vat and
// /reports/tax-projection still work directly; /reports by itself
// always lands on the default report.
export default function ReportsLandingPage() {
  redirect("/reports/pnl");
}

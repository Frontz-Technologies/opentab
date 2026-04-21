import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Persistent ribbon that labels an org as demo/sample data. Mounts in
// the authenticated layout only when `org.isDemo === true`, so the
// user always knows they're not looking at real records. Real orgs
// never see it — it's conditional on a per-org flag, not an env flag.
export async function DemoBanner() {
  const t = await getTranslations("demo");
  return (
    <div
      data-testid="demo-banner"
      className="sticky top-0 z-30 flex items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-on-surface"
    >
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-amber-500 text-[16px] leading-none"
      >
        auto_awesome
      </span>
      <span>{t("bannerText")}</span>
      <Link
        href="/settings/account"
        className="text-primary hover:underline font-medium"
      >
        {t("bannerAction")}
      </Link>
    </div>
  );
}

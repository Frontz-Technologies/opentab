import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface NotFoundViewProps {
  actionHref: string;
  actionKey: "backToDashboard" | "goToSignIn";
}

export async function NotFoundView({
  actionHref,
  actionKey,
}: NotFoundViewProps) {
  const t = await getTranslations("notFound");

  return (
    <main className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-8 py-16">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 flex select-none items-center justify-center font-headline text-[clamp(12rem,30vw,22rem)] font-black leading-none text-primary/10"
      >
        404
      </span>

      <div className="relative z-10 flex max-w-xl flex-col items-center gap-8 text-center">
        <h1 className="font-headline text-3xl font-bold text-on-surface md:text-4xl">
          {t("title")}
        </h1>
        <Link
          href={actionHref}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-sm font-bold text-on-primary transition-transform active:scale-95 hover:bg-primary/90"
        >
          {t(actionKey)}
        </Link>
      </div>
    </main>
  );
}

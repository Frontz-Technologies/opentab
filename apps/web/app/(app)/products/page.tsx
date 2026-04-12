import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { products } from "@opentab/db/schema";
import { eq, desc } from "drizzle-orm";
import { ProductList } from "./product-list";

export default async function ProductsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("products");

  const allProducts = await db
    .select()
    .from(products)
    .where(eq(products.orgId, session.org.id))
    .orderBy(desc(products.createdAt));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          {t("title")}
        </h1>
        <Link
          href="/products/new"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/80 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">
            add
          </span>
          {t("addProduct")}
        </Link>
      </div>
      <ProductList products={allProducts} />
    </div>
  );
}

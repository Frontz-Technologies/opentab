import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { products } from "@opentab/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { ProductList } from "./product-list";
import { Pagination } from "@/components/ui/pagination";
import {
  parsePage,
  paginationOffset,
  DEFAULT_PAGE_SIZE,
} from "@/lib/pagination";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("products");
  const params = await searchParams;
  const page = parsePage(params);

  const [allProducts, [{ total }]] = await Promise.all([
    db
      .select()
      .from(products)
      .where(eq(products.orgId, session.org.id))
      .orderBy(desc(products.createdAt))
      .limit(DEFAULT_PAGE_SIZE)
      .offset(paginationOffset(page)),
    db
      .select({ total: count() })
      .from(products)
      .where(eq(products.orgId, session.org.id)),
  ]);

  return (
    <>
      <PageHeader
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
        actions={
          <Link
            href="/products/new"
            aria-label={t("addProduct")}
            className="inline-flex items-center gap-1.5 h-8 px-2 sm:px-3 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/80 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">
              add
            </span>
            <span className="hidden sm:inline">{t("addProduct")}</span>
          </Link>
        }
      />
      <div className="px-6 py-6">
        <ProductList products={allProducts} />
        <Pagination
          totalItems={total}
          pageSize={DEFAULT_PAGE_SIZE}
          currentPage={page}
          className="mt-6"
        />
      </div>
    </>
  );
}

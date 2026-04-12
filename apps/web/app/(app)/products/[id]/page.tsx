import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { getCountryProvider } from "@/lib/country";
import { db } from "@/lib/db";
import { products } from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { ProductForm } from "../new/product-form";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.orgId, session.org.id)))
    .limit(1);

  if (!product) notFound();

  const t = await getTranslations("products");
  const provider = getCountryProvider(session.org.countryCode);

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="font-headline text-2xl font-bold text-on-surface">
        {t("editProduct")}
      </h1>
      <ProductForm product={product} vatRates={provider.vatRates} />
    </div>
  );
}

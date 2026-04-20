"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  products,
  createProductSchema,
  updateProductSchema,
} from "@/lib/entities/product";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";

export async function createProduct(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const parsed = createProductSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    unitPrice: formData.get("unitPrice"),
    unit: formData.get("unit"),
    taxCategory: formData.get("taxCategory"),
    vatRate: formData.get("vatRate") || undefined,
    active: formData.get("active") ?? "true",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const [product] = await db
    .insert(products)
    .values({
      orgId: session.org.id,
      name: data.name,
      description: data.description || null,
      unitPrice: data.unitPrice.toFixed(2),
      unit: data.unit,
      taxCategory: data.taxCategory,
      vatRate: data.vatRate !== undefined ? data.vatRate.toFixed(2) : null,
      active: data.active,
    })
    .returning();

  revalidatePath("/products");
  return { success: true, product };
}

export async function updateProduct(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const parsed = updateProductSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    unitPrice: formData.get("unitPrice"),
    unit: formData.get("unit"),
    taxCategory: formData.get("taxCategory"),
    vatRate: formData.get("vatRate") || undefined,
    active: formData.get("active") ?? "true",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  await db
    .update(products)
    .set({
      name: data.name,
      description: data.description || null,
      unitPrice: data.unitPrice.toFixed(2),
      unit: data.unit,
      taxCategory: data.taxCategory,
      vatRate: data.vatRate !== undefined ? data.vatRate.toFixed(2) : null,
      active: data.active,
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, id), eq(products.orgId, session.org.id)));

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { success: true };
}

export async function deleteProduct(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.orgId, session.org.id)));

  revalidatePath("/products");
  return { success: true };
}

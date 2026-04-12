"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { products } from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional().default(""),
  unitPrice: z.coerce.number().min(0, "Price must be non-negative"),
  unit: z.enum(["item", "hour", "day", "service", "kg", "unit"]),
  taxCategory: z.enum([
    "standard",
    "reduced",
    "super_reduced",
    "zero_rated",
    "exempt",
    "reverse_charge",
  ]),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  active: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "on"),
});

export async function createProduct(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const parsed = productSchema.safeParse({
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

  const parsed = productSchema.safeParse({
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

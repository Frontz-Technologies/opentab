"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { expenseCategories } from "@opentab/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";

const categorySchema = z.object({
  parentId: z.string().uuid().optional().or(z.literal("")),
  code: z.string().min(1).max(50),
  nameEn: z.string().min(1).max(255),
  nameEs: z.string().max(255).optional().default(""),
  nameEl: z.string().max(255).optional().default(""),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .or(z.literal("")),
  icon: z.string().max(50).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function createCategory(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const parsed = categorySchema.safeParse({
    parentId: formData.get("parentId") || undefined,
    code: formData.get("code"),
    nameEn: formData.get("nameEn"),
    nameEs: formData.get("nameEs") ?? "",
    nameEl: formData.get("nameEl") ?? "",
    color: formData.get("color") ?? "",
    icon: formData.get("icon") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  // Determine depth from parent
  let depth = 0;
  if (data.parentId) {
    const [parent] = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.id, data.parentId));

    if (!parent) {
      return {
        success: false,
        error: { parentId: ["Parent category not found"] },
      };
    }
    if (parent.depth >= 2) {
      return {
        success: false,
        error: { parentId: ["Maximum category depth (3 levels) reached"] },
      };
    }
    depth = parent.depth + 1;
  }

  const [category] = await db
    .insert(expenseCategories)
    .values({
      orgId: session.org.id,
      parentId: data.parentId || null,
      code: data.code,
      nameEn: data.nameEn,
      nameEs: data.nameEs || null,
      nameEl: data.nameEl || null,
      color: data.color || null,
      icon: data.icon || null,
      sortOrder: data.sortOrder,
      depth,
    })
    .returning();

  revalidatePath("/expenses/categories");
  return { success: true, category };
}

export async function updateCategory(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [existing] = await db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.id, id));

  if (!existing) {
    return { success: false, error: { _: ["Category not found"] } };
  }

  // Cannot edit system categories
  if (existing.orgId === null) {
    return {
      success: false,
      error: { _: ["System categories cannot be edited"] },
    };
  }

  // Must belong to the user's org
  if (existing.orgId !== session.org.id) {
    return { success: false, error: { _: ["Category not found"] } };
  }

  const parsed = categorySchema.safeParse({
    parentId: formData.get("parentId") || undefined,
    code: formData.get("code"),
    nameEn: formData.get("nameEn"),
    nameEs: formData.get("nameEs") ?? "",
    nameEl: formData.get("nameEl") ?? "",
    color: formData.get("color") ?? "",
    icon: formData.get("icon") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  await db
    .update(expenseCategories)
    .set({
      code: data.code,
      nameEn: data.nameEn,
      nameEs: data.nameEs || null,
      nameEl: data.nameEl || null,
      color: data.color || null,
      icon: data.icon || null,
      sortOrder: data.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(expenseCategories.id, id));

  revalidatePath("/expenses/categories");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [existing] = await db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.id, id));

  if (!existing) {
    return { success: false, error: "Category not found" };
  }

  if (existing.orgId === null) {
    return { success: false, error: "System categories cannot be deleted" };
  }

  if (existing.orgId !== session.org.id) {
    return { success: false, error: "Category not found" };
  }

  await db.delete(expenseCategories).where(eq(expenseCategories.id, id));

  revalidatePath("/expenses/categories");
  return { success: true };
}

export async function reorderCategories(
  orderedIds: { id: string; sortOrder: number }[],
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  for (const item of orderedIds) {
    await db
      .update(expenseCategories)
      .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
      .where(
        and(
          eq(expenseCategories.id, item.id),
          eq(expenseCategories.orgId, session.org.id),
        ),
      );
  }

  revalidatePath("/expenses/categories");
  return { success: true };
}

export async function getCategories(orgId: string) {
  const categories = await db.select().from(expenseCategories).where(
    // System categories (orgId = null) + org custom categories
    isNull(expenseCategories.orgId),
  );

  const orgCategories = await db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.orgId, orgId));

  return [...categories, ...orgCategories].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

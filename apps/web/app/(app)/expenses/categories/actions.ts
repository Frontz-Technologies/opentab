"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { expenseCategories, expenseGroups } from "@opentab/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import { ensureCategoriesSeeded } from "@/lib/expenses/category-seed";

const categorySchema = z.object({
  groupCode: z.string().min(1).max(30),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal("")),
  icon: z.string().max(50).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function getGroupedCategories() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await ensureCategoriesSeeded(session.org.id, session.org.countryCode);

  const groups = await db
    .select()
    .from(expenseGroups)
    .where(eq(expenseGroups.active, true))
    .orderBy(asc(expenseGroups.sortOrder));

  const categories = await db
    .select()
    .from(expenseCategories)
    .where(
      and(
        eq(expenseCategories.orgId, session.org.id),
        eq(expenseCategories.active, true),
      ),
    )
    .orderBy(asc(expenseCategories.sortOrder));

  return { groups, categories };
}

export async function createCategory(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const parsed = categorySchema.safeParse({
    groupCode: formData.get("groupCode"),
    code: formData.get("code"),
    name: formData.get("name"),
    color: formData.get("color") ?? "",
    icon: formData.get("icon") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const [category] = await db
    .insert(expenseCategories)
    .values({
      orgId: session.org.id,
      groupCode: data.groupCode,
      code: data.code,
      name: data.name,
      color: data.color || null,
      icon: data.icon || null,
      sortOrder: data.sortOrder,
    })
    .returning();

  revalidatePath("/expenses/categories");
  return { success: true, category };
}

export async function updateCategory(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const parsed = categorySchema.safeParse({
    groupCode: formData.get("groupCode"),
    code: formData.get("code"),
    name: formData.get("name"),
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
      groupCode: data.groupCode,
      code: data.code,
      name: data.name,
      color: data.color || null,
      icon: data.icon || null,
      sortOrder: data.sortOrder,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.orgId, session.org.id),
      ),
    );

  revalidatePath("/expenses/categories");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  // Default categories (one per group, country-seeded) are the per-group
  // fallback the form falls back to when the user disables every other
  // leaf in that group. Allowing delete would create groups with zero
  // categories, which the new-expense form has no way to recover from.
  // The UI already hides the delete button for isDefault rows; this is
  // server-side defence-in-depth.
  const [cat] = await db
    .select({ isDefault: expenseCategories.isDefault })
    .from(expenseCategories)
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.orgId, session.org.id),
      ),
    )
    .limit(1);

  if (!cat) return { success: false, error: "Category not found" };
  if (cat.isDefault) {
    return {
      success: false,
      error:
        "Default categories can't be deleted. Disable instead to keep the per-group fallback intact.",
    };
  }

  await db
    .delete(expenseCategories)
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.orgId, session.org.id),
      ),
    );

  revalidatePath("/expenses/categories");
  return { success: true };
}

export async function toggleCategory(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [cat] = await db
    .select()
    .from(expenseCategories)
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.orgId, session.org.id),
      ),
    );

  if (!cat) return { success: false, error: "Category not found" };

  await db
    .update(expenseCategories)
    .set({ active: !cat.active, updatedAt: new Date() })
    .where(eq(expenseCategories.id, id));

  revalidatePath("/expenses/categories");
  return { success: true };
}

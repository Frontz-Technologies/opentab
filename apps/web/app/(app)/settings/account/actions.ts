"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { auth } from "@/lib/auth-server";

export async function updateProfile(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("Name is required");

  await auth.api.updateUser({
    headers: await headers(),
    body: { name: name.trim() },
  });

  revalidatePath("/settings/account");
  return { success: true };
}

export async function changePassword(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!currentPassword || !newPassword) {
    return { success: false, error: "All fields are required" };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "passwordMismatch" };
  }

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: { currentPassword, newPassword },
    });
    revalidatePath("/settings/account");
    return { success: true };
  } catch {
    return { success: false, error: "wrongPassword" };
  }
}

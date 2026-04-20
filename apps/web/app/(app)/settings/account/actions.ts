"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { auth } from "@/lib/auth-server";
import { resetDemoOrg } from "@/lib/demo/ensure";
import { isDemoModeEnabled } from "@/lib/demo/ensure";

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

// Resets the current org's business data back to the demo baseline.
// Only works when:
// - the deployment has DEMO_SAMPLE_DATA_ENABLED=true (feature flag)
// - the caller is the org owner
// - the org is already flagged as a demo org (prevents accidental
//   wipe of real-org data via route manipulation)
export async function resetDemoAction() {
  if (!isDemoModeEnabled()) {
    return { success: false, error: "Demo mode is not enabled." };
  }
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated" };
  if (session.role !== "owner") {
    return { success: false, error: "Only owners can reset the demo." };
  }
  if (!session.org.isDemo) {
    return { success: false, error: "This is not a demo organisation." };
  }
  await resetDemoOrg(session.org.id);
  revalidatePath("/dashboard");
  revalidatePath("/contacts");
  revalidatePath("/products");
  revalidatePath("/invoices");
  revalidatePath("/expenses");
  revalidatePath("/reports");
  revalidatePath("/settings/account");
  return { success: true };
}

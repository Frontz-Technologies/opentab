import { redirect } from "next/navigation";
import { headers } from "next/headers";

function isMobileUA(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return /mobile|android|iphone|ipad/i.test(userAgent);
}

export default async function SettingsPage() {
  const headersList = await headers();
  const ua = headersList.get("user-agent");

  // On desktop, redirect to organisation settings (first item)
  // On mobile, the layout will show just the nav list
  if (!isMobileUA(ua)) {
    redirect("/settings/organisation");
  }

  // Mobile: render nothing — the layout shows the nav
  return null;
}

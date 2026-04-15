"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SettingsDesktopRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Only redirect on desktop (md breakpoint = 768px)
    if (window.innerWidth >= 768) {
      router.replace("/settings/organisation");
    }
  }, [router]);

  // On mobile, render nothing — the layout's SettingsMobileLayout
  // will show the nav list when pathname is /settings
  return null;
}

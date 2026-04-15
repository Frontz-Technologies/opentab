import { SettingsDesktopRedirect } from "@/components/settings/settings-desktop-redirect";

export default function SettingsPage() {
  // On desktop, redirect to /settings/organisation
  // On mobile, the layout renders the nav list (children is null here)
  return <SettingsDesktopRedirect />;
}

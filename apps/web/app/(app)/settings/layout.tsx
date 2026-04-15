import { SettingsNav } from "@/components/settings/settings-nav";
import { SettingsMobileLayout } from "@/components/settings/settings-mobile-layout";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-6">
      {/* Desktop: side-by-side layout */}
      <div className="hidden md:flex gap-6 max-w-6xl">
        <SettingsNav />
        <div className="flex-1 min-w-0">{children}</div>
      </div>

      {/* Mobile: either nav or content, handled by client component */}
      <div className="md:hidden">
        <SettingsMobileLayout>{children}</SettingsMobileLayout>
      </div>
    </div>
  );
}

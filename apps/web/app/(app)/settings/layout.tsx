import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 md:px-8 py-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-8">
        <SettingsNav />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

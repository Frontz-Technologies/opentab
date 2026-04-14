interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section className="bg-surface-container-low rounded-2xl p-6 space-y-5">
      <div>
        <h3 className="font-headline text-lg font-bold text-on-surface">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-on-surface-variant mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

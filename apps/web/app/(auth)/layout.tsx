export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding atmosphere (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-surface-container-low items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/5 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary-container/10 blur-3xl rounded-full" />
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-xl">
                account_balance
              </span>
            </div>
            <span className="font-headline text-2xl font-bold text-on-surface">
              OpenTab
            </span>
          </div>
          <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight mb-4">
            Keep tabs on your business
          </h2>
          <p className="text-on-surface-variant text-lg leading-relaxed">
            AI-native financial platform for freelancers and startups. Invoice,
            track expenses, and understand your finances — without calling your
            accountant.
          </p>
          <p className="mt-8 text-sm font-label text-on-surface-variant/60 uppercase tracking-widest">
            opentab.tech
          </p>
        </div>
      </div>
      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-dim">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

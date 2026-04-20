import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import {
  Manrope,
  Inter,
  Space_Grotesk,
  JetBrains_Mono,
  Geist,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getUserPreferences } from "@/lib/actions/user-preferences";
import {
  resolveTheme,
  THEME_COOKIE_NAME,
  THEME_PRE_HYDRATION_SCRIPT,
  type ThemePreference,
} from "@/lib/theme";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const manrope = Manrope({
  subsets: ["latin", "greek"],
  variable: "--font-headline",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "greek"],
  variable: "--font-body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-label",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenTab: Keep tabs on your business",
  description: "AI-native financial platform for freelancers and startups.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  // Resolve theme preference: DB for authenticated users, cookie fallback
  // otherwise. The inline pre-hydration Script below corrects the class for
  // the `system` case before paint, which server rendering cannot know.
  const cookieStore = await cookies();
  const cookiePref = cookieStore.get(THEME_COOKIE_NAME)?.value as
    | ThemePreference
    | undefined;
  let pref: ThemePreference = cookiePref ?? "dark";
  try {
    const userPref = await getUserPreferences();
    if (userPref?.theme) {
      pref = userPref.theme as ThemePreference;
    }
  } catch {
    // unauthenticated or DB unavailable — cookie fallback stands
  }
  // For 'system' preference, omit the class server-side and let the inline
  // pre-hydration script set it based on the actual OS preference. This
  // avoids a reconciliation loop after Server Actions where the server's
  // assumed class keeps overwriting the client-side optimistic flip.
  // For 'dark' / 'light', we can stamp the class authoritatively.
  const isDark = pref !== "system" && resolveTheme(pref, false) === "dark";

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        isDark && "dark",
        manrope.variable,
        inter.variable,
        spaceGrotesk.variable,
        jetbrainsMono.variable,
        "font-sans",
        geist.variable,
      )}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_PRE_HYDRATION_SCRIPT}
        </Script>
      </head>
      <body className="font-body antialiased bg-surface-dim text-on-surface">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

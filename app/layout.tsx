import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { AppShell } from "../components/app-shell";
import { Providers } from "../components/providers";
import { AuthProvider } from "../components/auth-provider";
import { getMessages } from "../lib/i18n/messages";
import { I18nProvider } from "../lib/i18n/provider";
import { getI18n, getLocale } from "../lib/i18n/server";

// Self-hosted by next/font at build time (no runtime request to Google).
// latin-ext covers č, š, ž.
const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "wdth"],
  variable: "--font-display",
  display: "swap",
});
const body = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return {
    title: m.common.meta.title,
    description: m.common.meta.description,
    // Private by default; only public pages opt in (see lib/seo.ts).
    robots: { index: false, follow: false },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets env(safe-area-inset-*) report the home-indicator area on iOS.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#111d19" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Cookie, then Accept-Language, then Slovenian (lib/i18n/config.ts). Only the
  // active catalog is sent, as JSON in the RSC payload, not in client chunks.
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body>
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          <Providers>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}

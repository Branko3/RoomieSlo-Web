import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "../components/app-shell";
import { Providers } from "../components/providers";
import { AuthProvider } from "../components/auth-provider";

export const metadata: Metadata = {
  title: "RoomieSlo — najdi svoj dom",
  description: "Poišči sostanovalca, ki mu res ustrezaš.",
  // Private by default; only public pages opt in (see lib/seo.ts).
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sl">
      <body>
        <Providers>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "../components/app-shell";
import { Providers } from "../components/providers";
import { SessionProvider } from "../components/session-provider";

export const metadata: Metadata = {
  title: "RoomieSlo — najdi svoj dom",
  description: "Poišči sostanovalca, ki mu res ustrezaš.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sl">
      <body>
        <Providers>
          <SessionProvider>
            <AppShell>{children}</AppShell>
          </SessionProvider>
        </Providers>
      </body>
    </html>
  );
}

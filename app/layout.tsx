import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "../components/app-shell";
import { Providers } from "../components/providers";

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
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

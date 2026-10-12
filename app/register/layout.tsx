import type { Metadata } from "next";

// A public page: may be indexed (overrides the private default in app/layout.tsx).
export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

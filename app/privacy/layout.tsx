import type { Metadata } from "next";

// The privacy notice is public and may be indexed (overrides the private default in app/layout.tsx).
export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function PrivacyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

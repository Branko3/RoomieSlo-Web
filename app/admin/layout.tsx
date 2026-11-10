import type { Metadata } from "next";
import { getI18n } from "../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return {
    title: m.admin.meta.title,
    robots: { index: false, follow: false },
  };
}

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

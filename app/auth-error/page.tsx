import type { Metadata } from "next";
import { LanguageSwitcher } from "../../components/language-switcher";
import { getI18n } from "../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return {
    title: m.auth.authError.metaTitle,
    robots: { index: false, follow: false },
  };
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const { m } = await getI18n();
  const t = m.auth.authError;
  const message =
    searchParams.reason === "configuration" ? t.configuration : t.session;
  return (
    <div className="page-state" role="alert">
      <h1>{t.title}</h1>
      <p>{message}</p>
      <LanguageSwitcher className="page-language" />
    </div>
  );
}

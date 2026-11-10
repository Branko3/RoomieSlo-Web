import type { Metadata } from "next";
import { AcademicDocumentUpload } from "../../components/academic-document-upload";
import { getI18n } from "../../lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return {
    title: m.account.academic.metaTitle,
    robots: { index: false, follow: false },
  };
}

export default async function AcademicVerificationPage() {
  const { m } = await getI18n();
  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <h1>{m.account.academic.title}</h1>
        </div>
      </header>
      <p className="muted">{m.account.academic.intro}</p>
      <AcademicDocumentUpload />
    </div>
  );
}

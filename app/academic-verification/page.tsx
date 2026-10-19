import type { Metadata } from "next";
import { AcademicDocumentUpload } from "../../components/academic-document-upload";

export const metadata: Metadata = {
  title: "Preverjanje akademskega statusa — RoomieSlo",
  robots: { index: false, follow: false },
};

export default function AcademicVerificationPage() {
  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <h1>Preverjanje akademskega statusa</h1>
        </div>
      </header>
      <p className="muted">
        Naloži potrdilo o vpisu (vpisnico), da drugi uporabniki vidijo, da si
        preverjen študent. To omogoča preverjanje statusa tudi pred uradnim
        začetkom semestra.
      </p>
      <AcademicDocumentUpload />
    </div>
  );
}

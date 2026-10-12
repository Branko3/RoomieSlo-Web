import { Suspense } from "react";
import { EmailConfirmationPanel } from "../../../components/email-confirmation-panel";

export default function EmailConfirmationPage() {
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="brand-mark">R</span>
        <b>
          Roomie<span>Slo</span>
        </b>
      </div>
      <Suspense fallback={<div className="auth-card" aria-busy="true" />}>
        <EmailConfirmationPanel />
      </Suspense>
    </div>
  );
}

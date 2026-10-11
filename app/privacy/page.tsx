"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ExportError,
  exportCopy,
  exportFileName,
  exportMyData,
  privacyRequestHref,
  type ExportClient,
} from "../../lib/privacy/export";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

const contact = process.env.NEXT_PUBLIC_PRIVACY_CONTACT ?? "";

function download(json: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PrivacyPage() {
  const exporter = useMutation({
    mutationFn: async () => {
      const result = await exportMyData(
        createSupabaseBrowserClient() as unknown as ExportClient,
      );
      download(
        JSON.stringify(result, null, 2),
        exportFileName(result.account.id),
      );
      return result;
    },
  });
  const error = exporter.error
    ? exporter.error instanceof ExportError
      ? exporter.error.message
      : exportCopy.failed
    : null;

  return (
    <div className="content-wrap narrow-content">
      <header className="topbar">
        <div>
          <p className="eyebrow">ZASEBNOST</p>
          <h1>Tvoji podatki</h1>
        </div>
      </header>

      <section className="profile-card privacy-section">
        <div>
          <b>Katere podatke hranimo</b>
          <p>
            Profil (ime, starost, fakulteta, opis, fotografija), odgovore
            vprašalnika, tvoje oglase, priljubljene, ujemanja in sporočila,
            prijave, ki si jih oddal, ter dokazilo o vpisu v zasebni shrambi, do
            katere imata dostop le ti in skrbnik.
          </p>
        </div>
      </section>

      <section className="profile-card privacy-section">
        <div>
          <b>Prenesi svoje podatke</b>
          <p>
            Pripravimo datoteko JSON z vsemi podatki, ki jih lahko vidiš o sebi.
          </p>
          {error && (
            <p className="privacy-error" role="alert">
              {error}
            </p>
          )}
          {exporter.isSuccess && (
            <p role="status">Datoteka je pripravljena in prenesena.</p>
          )}
        </div>
        <button
          type="button"
          className="button"
          disabled={exporter.isPending}
          onClick={() => exporter.mutate()}
        >
          {exporter.isPending ? "Pripravljam ..." : "Prenesi podatke"}
        </button>
      </section>

      <section className="profile-card privacy-section">
        <div>
          <b>Izbris računa in popravki</b>
          <p>
            Izbris računa trenutno opravi skrbnik na tvojo zahtevo, ker mora
            hkrati izbrisati tudi dokazilo o vpisu in upoštevati pravila hrambe
            prijav. Na zahtevo odgovorimo najpozneje v enem mesecu.
          </p>
        </div>
        {contact ? (
          <div className="privacy-actions">
            <a
              className="button button-outline"
              href={privacyRequestHref(contact, "deletion")}
            >
              Zahtevaj izbris
            </a>
            <a
              className="text-link"
              href={privacyRequestHref(contact, "correction")}
            >
              Zahtevaj popravek
            </a>
          </div>
        ) : (
          <p className="muted">Kontakt za zasebnost še ni nastavljen.</p>
        )}
      </section>
    </div>
  );
}

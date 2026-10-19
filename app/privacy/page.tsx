"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import {
  ExportError,
  exportCopy,
  exportFileName,
  exportMyData,
  privacyRequestHref,
  type ExportClient,
} from "../../lib/privacy/export";
import { DATA_CONTROLLER, privacyContact } from "../../lib/privacy/controller";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

const contact = privacyContact();

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
          <h1>Tvoji podatki</h1>
        </div>
      </header>

      <section className="profile-card privacy-section">
        <div>
          <b>Upravljavec podatkov</b>
          <p>
            Upravljavec tvojih osebnih podatkov v aplikaciji RoomieSlo je{" "}
            {DATA_CONTROLLER}.{" "}
            {contact ? (
              <>
                Kontakt: <a href={`mailto:${contact}`}>{contact}</a>
              </>
            ) : (
              "Kontakt za zasebnost še ni nastavljen."
            )}
          </p>
        </div>
      </section>

      <section className="profile-card privacy-section">
        <div>
          <b>Katere podatke hranimo</b>
          <p>
            Profil (ime, starost, fakulteta, opis, fotografija), odgovore
            vprašalnika, tvoje oglase, priljubljene, ujemanja in sporočila,
            sobivanja (»Živiva skupaj«) in ocene sostanovalcev, prijave, ki si
            jih oddal(a), ter dokazilo o vpisu v zasebni shrambi, do katere
            imata dostop le ti in skrbnik.
          </p>
          <p>
            Ob prijavi zlorabe lahko skrbnik pregleda pogovor, povezan s
            prijavo; vsak tak vpogled se zabeleži. Upravljavec baze lahko do
            sporočil dostopa za vzdrževanje in obravnavo zlorab. Po izbrisu
            računa ostanejo tvoja sporočila drugi osebi vidna kot »Izbrisan
            uporabnik«, prijave pa se anonimizirane hranijo 12 mesecev po
            zaključku.
          </p>
          <p>
            Če je bil račun prijavljen zaradi zlorabe, njegove kontaktne podatke
            (e-naslov, ime) hranimo do 12 mesecev po zaključku prijave; sicer
            jih izbrišemo 30 dni po izbrisu računa. Dostop ima le upravljavec
            baze.
          </p>
        </div>
      </section>

      <section
        className="profile-card privacy-section"
        aria-labelledby="privacy-ratings-title"
      >
        <div>
          <b id="privacy-ratings-title">Ocene sostanovalcev</b>
          <p>
            Ocene obdelujemo na podlagi zakonitega interesa (6(1)(f) člen GDPR):
            drugim uporabnikom pomagajo varneje izbrati sostanovalca. Oceniš
            lahko samo osebo, s katero imaš potrjeno sobivanje (»Živiva
            skupaj«), in sicer enkrat na sobivanje.
          </p>
          <p>
            Prikaz ocen je privzeto izklopljen: dokler na profilu ne vklopiš
            »Prikaži ocene sostanovalcev«, se ocene zbirajo zasebno in jih vidiš
            samo ti. Ko jih vklopiš, drugi vidijo le povzetek, na primer »3 od 4
            sostanovalcev bi spet živeli s to osebo«, in do 3 najpogostejše
            močne točke. Povzetek prikažemo šele, ko imaš vsaj 3 ocene; prej
            drugi vidijo »Še ni dovolj ocen«. Vsaka oseba se šteje enkrat.
            Področja za izboljšanje vidiš samo ti. Nihče, tudi ocenjena oseba
            ne, ne vidi, kdo je dal katero oceno. Ocene niso prikazane na
            oglasih.
          </p>
          <p>
            Ocena je skrita, dokler ne oceni tudi druga oseba ali ne mine 14
            dni. Štejejo le ocene iz zadnjih 36 mesecev; ocene izbrišemo 36
            mesecev po koncu sobivanja. Ob izbrisu računa izbrišemo ocene, ki si
            jih prejel(a); ocene, ki si jih dal(a), ostanejo v povzetku druge
            osebe brez tvojega imena.
          </p>
          <p>
            Prikaz lahko kadar koli spet izklopiš. Če želiš, da tvojih ocen
            sploh ne hranimo, nam piši in jih izbrišemo. Če meniš, da je ocena
            nepoštena ali da sobivanja ni bilo,{" "}
            {contact ? (
              <>
                piši na <a href={`mailto:${contact}`}>{contact}</a>.
              </>
            ) : (
              "piši upravljavcu (kontakt še ni nastavljen)."
            )}{" "}
            Upravljavec oceno preveri in nepošteno oceno izbriše; nikomur ne
            razkrije, kdo jo je dal.
          </p>
        </div>
      </section>

      <section className="profile-card privacy-section">
        <div>
          <b>Prenesi svoje podatke</b>
          <p>
            Pripravimo datoteko JSON z vsemi podatki, ki jih lahko vidiš o sebi,
            vključno s tvojimi sobivanji, ocenami, ki si jih dal(a), in
            povzetkom ocen, ki si jih prejel(a) (brez podatka, kdo je ocenil).
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
            Račun lahko izbrišeš sam, ko si prijavljen: Profil → Izbriši račun.
            Če to ne gre, nam piši in izbris opravimo v enem mesecu.
          </p>
        </div>
        <div className="privacy-actions">
          <Link
            className="button button-outline"
            href="/profile/delete-account"
          >
            Izbriši račun
          </Link>
        </div>
        {contact ? (
          <div className="privacy-actions">
            <a
              className="text-link"
              href={privacyRequestHref(contact, "deletion")}
            >
              Zahtevaj izbris po e-pošti
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

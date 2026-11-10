// Slovenian "privacy" namespace: the privacy notice on /privacy, the data
// export and request e-mails. The Slovenian notice is the authoritative text.
export const privacy = {
  title: "Tvoji podatki",
  // Shown only in translations (the Slovenian text prevails).
  translationNotice:
    "Prevod je informativen; v primeru razlik velja slovensko besedilo.",
  controller: {
    title: "Upravljavec podatkov",
    body: "Upravljavec tvojih osebnih podatkov v aplikaciji RoomieSlo je {controller}.",
    contact: "Kontakt:",
    contactMissing: "Kontakt za zasebnost še ni nastavljen.",
  },
  data: {
    title: "Katere podatke hranimo",
    stored:
      "Profil (ime, starost, fakulteta, opis, fotografija), odgovore vprašalnika, tvoje oglase, priljubljene, ujemanja in sporočila, sobivanja (»Živiva skupaj«) in ocene sostanovalcev, prijave, ki si jih oddal(a), ter dokazilo o vpisu v zasebni shrambi, do katere imata dostop le ti in skrbnik.",
    access:
      "Ob prijavi zlorabe lahko skrbnik pregleda pogovor, povezan s prijavo; vsak tak vpogled se zabeleži. Upravljavec baze lahko do sporočil dostopa za vzdrževanje in obravnavo zlorab. Po izbrisu računa ostanejo tvoja sporočila drugi osebi vidna kot »Izbrisan uporabnik«, prijave pa se anonimizirane hranijo 12 mesecev po zaključku.",
    safety:
      "Če je bil račun prijavljen zaradi zlorabe, njegove kontaktne podatke (e-naslov, ime) hranimo do 12 mesecev po zaključku prijave; sicer jih izbrišemo 30 dni po izbrisu računa. Dostop ima le upravljavec baze.",
    cookie:
      "Izbrani jezik vmesnika shranimo v tem brskalniku v piškotek roomieslo-locale za eno leto. Piškotek je funkcionalen, ne vsebuje osebnih podatkov in zanj ne potrebujemo tvoje privolitve.",
  },
  ratings: {
    title: "Ocene sostanovalcev",
    basis:
      "Ocene obdelujemo na podlagi zakonitega interesa (6(1)(f) člen GDPR): drugim uporabnikom pomagajo varneje izbrati sostanovalca. Oceniš lahko samo osebo, s katero imaš potrjeno sobivanje (»Živiva skupaj«), in sicer enkrat na sobivanje.",
    visibility:
      "Prikaz ocen je privzeto izklopljen: dokler na profilu ne vklopiš »Prikaži ocene sostanovalcev«, se ocene zbirajo zasebno in jih vidiš samo ti. Ko jih vklopiš, drugi vidijo le povzetek, na primer »3 od 4 sostanovalcev bi spet živeli s to osebo«, in do 3 najpogostejše močne točke. Povzetek prikažemo šele, ko imaš vsaj 3 ocene; prej drugi vidijo »Še ni dovolj ocen«. Vsaka oseba se šteje enkrat. Področja za izboljšanje vidiš samo ti. Nihče, tudi ocenjena oseba ne, ne vidi, kdo je dal katero oceno. Ocene niso prikazane na oglasih.",
    timing:
      "Ocena je skrita, dokler ne oceni tudi druga oseba ali ne mine 14 dni. Štejejo le ocene iz zadnjih 36 mesecev; ocene izbrišemo 36 mesecev po koncu sobivanja. Ob izbrisu računa izbrišemo ocene, ki si jih prejel(a); ocene, ki si jih dal(a), ostanejo v povzetku druge osebe brez tvojega imena.",
    control:
      "Prikaz lahko kadar koli spet izklopiš. Če želiš, da tvojih ocen sploh ne hranimo, nam piši in jih izbrišemo. Če meniš, da je ocena nepoštena ali da sobivanja ni bilo,",
    // Followed by the contact e-mail link and a full stop.
    writeTo: "piši na",
    noContact: "piši upravljavcu (kontakt še ni nastavljen).",
    review:
      "Upravljavec oceno preveri in nepošteno oceno izbriše; nikomur ne razkrije, kdo jo je dal.",
  },
  export: {
    title: "Prenesi svoje podatke",
    body: "Pripravimo datoteko JSON z vsemi podatki, ki jih lahko vidiš o sebi, vključno s tvojimi sobivanji, ocenami, ki si jih dal(a), in povzetkom ocen, ki si jih prejel(a) (brez podatka, kdo je ocenil).",
    ready: "Datoteka je pripravljena in prenesena.",
    preparing: "Pripravljam ...",
    submit: "Prenesi podatke",
    // Part of the downloaded file name: roomieslo-<fileLabel>-<id>-<date>.json
    fileLabel: "podatki",
    errors: {
      "signed-out": "Za prenos podatkov se moraš prijaviti.",
      offline: "Ni povezave. Poskusi znova.",
      failed: "Podatkov ni bilo mogoče pripraviti. Poskusi znova.",
    },
    // The `notes` of the exported file, in this order.
    notes: {
      messages:
        "Sporočila druge osebe v tvojih klepetih niso vključena; vključena so tvoja poslana sporočila.",
      documents:
        "Akademski dokumenti so navedeni po imenu; datoteke lahko zahtevaš pri skrbniku.",
      ratings:
        "Ocene, ki si jih prejel(a), so vključene le kot povzetek; kdo je dal katero oceno, ni vključeno, ker bi to razkrilo podatke drugih oseb.",
    },
  },
  deletion: {
    title: "Izbris računa in popravki",
    body: "Račun lahko izbrišeš sam, ko si prijavljen: Profil → Izbriši račun. Če to ne gre, nam piši in izbris opravimo v enem mesecu.",
    deleteAccount: "Izbriši račun",
    requestDeletion: "Zahtevaj izbris po e-pošti",
    requestCorrection: "Zahtevaj popravek",
  },
  requests: {
    subjects: {
      deletion: "Zahteva za izbris računa",
      correction: "Zahteva za popravek podatkov",
      other: "Vprašanje o zasebnosti",
    },
    accountId: "ID računa",
    description: "Opis zahteve",
  },
};

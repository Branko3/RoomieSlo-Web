// Slovenian "account" namespace: account deletion and academic verification.
export const account = {
  deletion: {
    back: "Nazaj na profil",
    title: "Izbriši račun",
    // {strong} is replaced with the bold word `final`.
    final: "Izbris je {strong} in ga ni mogoče razveljaviti.",
    finalStrong: "dokončen",
    removedTitle: "Takoj izbrišemo",
    removed: {
      login: "prijavo v račun (e-naslov in geslo),",
      profile:
        "profil: ime, starost, fakulteto, opis, fotografijo in status preverjanja,",
      content: "odgovore vprašalnika, priljubljene in tvoje oglase,",
      document: "dokazilo o vpisu iz zasebne shrambe,",
      requests: "zahteve za ujemanje, na katere še ni odgovora,",
      ratings: "ocene, ki so jih o tebi oddali sostanovalci.",
    },
    keptTitle: "Ostane, brez tvojega imena",
    kept: {
      messages:
        "sporočila v pogovorih ostanejo drugi osebi, podpisana kot »Izbrisan uporabnik«; izbrišemo jih, ko svoj račun izbriše tudi ona,",
      reports:
        "prijave zlorab, ki si jih oddal(a) ali so bile oddane zoper tebe, do 12 mesecev po zaključku,",
      cohabitations:
        "sobivanja ostanejo drugi osebi v njeni zgodovini: trenutno sobivanje se zaključi s tem mesecem, nepotrjena izjava »Živiva skupaj« pa se zapre kot nepotrjena. Izbrišemo jih, ko svoj račun izbriše tudi druga oseba,",
      ratings:
        "ocene, ki si jih dal(a), ostanejo v povzetku druge osebe brez tvojega imena, največ 36 mesecev po koncu sobivanja,",
      safety:
        "tvoj e-naslov in ime v zaščitenem zapisu za varnostne primere: 30 dni oziroma do 12 mesecev po zaključku prijave zoper tebe; dostop ima le upravljavec baze.",
    },
    backups:
      "Varnostne kopije potečejo v 30 dneh; do takrat so izbrisani podatki lahko še v njih.",
    password: "Geslo",
    // {phrase} is replaced with the bold confirmation phrase.
    confirmLabel: "Za potrditev vpiši {phrase}",
    cancel: "Prekliči",
    submit: "Trajno izbriši račun",
    submitting: "Brisanje …",
    errors: {
      "invalid-confirmation": "Za potrditev vpiši »{phrase}«.",
      "missing-password": "Vnesi geslo.",
      "wrong-password": "Geslo ni pravilno.",
      "signed-out": "Seja je potekla. Prijavi se znova in poskusi še enkrat.",
      reauth:
        "Za izbris se moraš znova prijaviti. Vnesi geslo in poskusi znova.",
      partial:
        "Izbris ni bil dokončan. Tvoji podatki niso bili izbrisani v celoti; piši nam, da ga dokončamo.",
      offline: "Ni povezave. Poskusi znova.",
      failed: "Računa ni bilo mogoče izbrisati. Poskusi znova.",
    },
  },
  academic: {
    metaTitle: "Preverjanje akademskega statusa — RoomieSlo",
    title: "Preverjanje akademskega statusa",
    intro:
      "Naloži potrdilo o vpisu (vpisnico), da drugi uporabniki vidijo, da si preverjen študent. To omogoča preverjanje statusa tudi pred uradnim začetkom semestra.",
    loading: "Nalaganje …",
    unavailable:
      "Nalaganje dokumentov trenutno ni na voljo. Poskusi znova kasneje.",
    signedOut: "Za nalaganje potrdila o vpisu se moraš prijaviti.",
    signIn: "Prijava",
    existing:
      "Potrdilo je že naloženo in čaka na preverjanje. Novo datoteko lahko naložiš, da zamenjaš obstoječo.",
    pick: "Izberi datoteko (PDF, JPG ali PNG, največ 10 MB)",
    help: "Dokument vidiš samo ti in skrbniki, ki preverijo tvoj status.",
    progress: "Napredek nalaganja",
    done: "Naloženo: {fileName}. Potrdilo čaka na preverjanje skrbnika.",
    cancel: "Prekliči ({percent} %)",
    retry: "Poskusi znova",
    submit: "Pošlji v preverjanje",
    continue: "Nadaljuj",
    skip: "Preskoči za zdaj",
    validation: {
      unsupported_type: "Izberi datoteko PDF, JPG ali PNG.",
      extension_mismatch: "Končnica datoteke se ne ujema z njeno vrsto.",
      empty: "Datoteka je prazna. Izberi drugo datoteko.",
      too_large: "Datoteka je prevelika ({size}). Največja velikost je {max}.",
    },
    uploadErrors: {
      permission: "Za nalaganje se moraš znova prijaviti.",
      "too-large": "Datoteka je prevelika za nalaganje.",
      offline: "Ni povezave. Preveri internet in poskusi znova.",
      aborted: "Nalaganje je bilo preklicano.",
      unknown: "Nalaganje ni uspelo. Poskusi znova.",
    },
  },
};

// Slovenian "admin" namespace: the reports dashboard.
export const admin = {
  meta: {
    title: "Administracija — RoomieSlo",
  },
  title: "Administratorska plošča",
  intro: "Prijave uporabnikov, najnovejše najprej.",
  loading: "Nalaganje prijav ...",
  signIn: "Prijava",
  home: "Na začetek",
  filters: "Status prijav",
  all: "Vse",
  filterCount: "{label} ({count})",
  status: {
    open: "Odprto",
    reviewed: "Rešeno",
    dismissed: "Zavrnjeno",
  },
  empty: "Ni prijav.",
  emptyFilter: "Ni prijav s tem statusom.",
  reportedLine: "{date} · prijavljen {who}",
  reportedUser: "uporabnik {id}",
  reportedDeleted:
    "Izbrisan uporabnik (identiteta hranjena za varnostne namene; za razkritje kontaktiraj upravljavca baze)",
  markReviewed: "Označi kot rešeno",
  reopen: "Ponovno odpri",
  dismiss: "Zavrni",
  footnote: "Prikazanih je največ {limit} najnovejših prijav.",
  errors: {
    notAdmin: "Nimaš administratorskih pravic.",
    signedOut: "Za administratorsko ploščo se moraš prijaviti.",
    loadFailed: "Napaka pri nalaganju prijav.",
    updateFailed: "Statusa prijave ni bilo mogoče spremeniti.",
    conversationFailed: "Pogovora ni bilo mogoče naložiti.",
    offline: "Ni povezave. Preveri internetno povezavo.",
  },
  conversation: {
    show: "Prikaži pogovor",
    hide: "Skrij pogovor",
    logged: "Vsak ogled pogovora se zabeleži (administrator, prijava, čas).",
    region: "Prijavljeni pogovor",
    loading: "Nalaganje pogovora …",
    empty: "Pogovor ni več na voljo.",
    roles: {
      reporter: "Prijavitelj",
      reported: "Prijavljeni",
    },
  },
};

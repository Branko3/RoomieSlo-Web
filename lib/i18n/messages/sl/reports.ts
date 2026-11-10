// Slovenian "reports" namespace: the report form ("Prijava" here means a
// report, never signing in, except in `signIn`).
export const reports = {
  unavailableTitle: "Prijava ni mogoča",
  back: "Nazaj",
  sentTitle: "Prijava poslana",
  sent: "Hvala. Prijava je poslana in jo bo pregledal administrator.",
  titleListing: "Prijavi oglas",
  titleUser: "Prijavi uporabnika",
  intro:
    "Prijavo pregleda administrator. Prijavljena oseba ne izve, kdo jo je prijavil.",
  reason: "Razlog",
  description: "Dodatni opis (neobvezno)",
  signIn: "Prijava",
  submitting: "Pošiljam...",
  submit: "Pošlji prijavo",
  loading: "Nalaganje ...",
  // Labels of the stored reasons (REPORT_REASONS in lib/reports/report.ts).
  reasons: {
    inappropriate: "Neprimerna vsebina",
    fake: "Lažen profil ali oglas",
    harassment: "Nadlegovanje",
    other: "Drugo",
  },
  errors: {
    "invalid-user": "Neveljaven uporabnik.",
    "invalid-reason": "Izberi razlog prijave.",
    "too-long": "Opis je lahko dolg največ {max} znakov.",
    self: "Sebe ne moreš prijaviti.",
    "signed-out": "Za prijavo se moraš prijaviti v svoj račun.",
    "missing-user": "Tega uporabnika ni več mogoče prijaviti.",
    offline: "Ni povezave. Preveri internetno povezavo.",
    failed: "Prijava ni bila poslana.",
  },
};

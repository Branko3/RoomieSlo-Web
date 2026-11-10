import { pluralForms } from "../plural";

// Slovenian "questionnaire" namespace: the lifestyle questionnaire, its
// progress card on /profile and the recommendation readiness notice.
export const questionnaire = {
  title: "Vprašalnik o življenjskem slogu",
  progress: "Izpolnjenih {answered} od {total} trditev",
  skip: "Preskoči",
  loading: "Nalaganje vprašalnika …",
  signedOutTitle: "Nisi prijavljen",
  loadFailedTitle: "Vprašalnika ni bilo mogoče naložiti",
  unavailable: "Vprašalnik trenutno ni na voljo.",
  signIn: "Prijava",
  retry: "Poskusi znova",
  intro:
    "Označi, koliko se strinjaš s trditvami. Vprašalnik lahko kadar koli preskočiš; neodgovorjene trditve ne vplivajo na ujemanje.",
  saving: "Shranjujem …",
  save: "Shrani in nadaljuj",
  errors: {
    "signed-out": "Za izpolnjevanje vprašalnika se moraš prijaviti.",
    permission:
      "Nimaš dovoljenja za shranjevanje teh odgovorov. Prijavi se znova.",
    offline: "Ni povezave. Preveri internet in poskusi znova.",
    unknown: "Shranjevanje ni uspelo. Poskusi znova.",
  },
  // Keyed by the stored statement id (lib/questionnaire/model.ts).
  statements: {
    q_cleanliness: "Skupni prostori morajo biti vedno pospravljeni.",
    q_costs: "Svoj del stroškov poravnam do dogovorjenega roka.",
    q_smoking: "Kajenje v stanovanju me ne moti.",
    q_parties: "Občasne zabave v stanovanju me ne motijo.",
    q_noise: "Zvečer imam rad(a) mir in tišino.",
    q_chores:
      "Gospodinjska opravila naj bodo razdeljena po dogovorjenem razporedu.",
    q_guests: "Vesel(a) sem, če so v stanovanju pogosto obiski.",
    q_pets: "V stanovanju bi rad(a) imel(a) hišnega ljubljenčka.",
    q_study: "Doma se pogosto učim in takrat potrebujem mir.",
    q_overnight: "Ne moti me, če gostje ali partner(ka) prespijo v stanovanju.",
    q_wake: "Zjutraj vstajam zgodaj in zvečer hodim zgodaj spat.",
  },
  // Keyed by the Likert level key.
  likert: {
    strongly_disagree: "Sploh se ne strinjam",
    disagree: "Se ne strinjam",
    neutral: "Niti da niti ne",
    agree: "Se strinjam",
    strongly_agree: "Popolnoma se strinjam",
    no_answer: "Ne želim odgovoriti",
  },
  card: {
    progressFailed: "Napredka ni bilo mogoče naložiti.",
    loading: "Nalaganje …",
    progressLabel: "Izpolnjenost vprašalnika",
    edit: "Uredi",
    continue: "Nadaljuj",
    start: "Začni",
  },
  readiness: {
    noAnswersTitle: "Najprej izpolni vprašalnik",
    noAnswersBody:
      "Priporočila razvrstimo po združljivosti tvojih odgovorov. Odgovori na vsaj {statements} o življenjskem slogu.",
    insufficientTitle: "Za priporočila potrebujemo več odgovorov",
    insufficientBody:
      "Odgovoril(a) si na {answered}. Odgovori še na {missing}, da bodo ocene združljivosti zanesljive.",
    statements: pluralForms({
      one: "{count} trditev",
      two: "{count} trditvi",
      few: "{count} trditve",
      other: "{count} trditev",
    }),
  },
};

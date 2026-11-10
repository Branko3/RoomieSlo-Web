import { pluralForms } from "../plural";

// Slovenian "ratings" namespace: roommate ratings in the chat, on /profile and
// in the public summary.
export const ratings = {
  // Keyed by RatingErrorKind (lib/ratings/ratings.ts).
  errors: {
    "signed-out": "Za to dejanje se prijavi.",
    permission: "Te osebe zdaj ne moreš oceniti.",
    offline: "Ni povezave. Preveri internet in poskusi znova.",
    invalid:
      "Odgovori na vprašanje Da/Ne in izberi največ 3 oznake v vsakem sklopu.",
    window: "Ocenjevanje za to sobivanje trenutno ni odprto.",
    locked: "Oceno lahko posodobiš šele 6 mesecev po zadnji oddaji.",
    unknown: "Ocene ni bilo mogoče shraniti. Poskusi znova.",
  },
  // Keyed by RatingLoadFailure (lib/ratings/ratings.ts).
  loadErrors: {
    "signed-out": "Za to dejanje se prijavi.",
    permission: "Te osebe zdaj ne moreš oceniti.",
    offline: "Ni povezave. Preveri internet in poskusi znova.",
    unknown: "Ocen ni bilo mogoče naložiti.",
  },
  count: pluralForms({
    one: "{count} ocena",
    two: "{count} oceni",
    few: "{count} ocene",
    other: "{count} ocen",
  }),
  insufficient: "Še ni dovolj ocen",
  none: "Še nimaš ocen.",
  belowThreshold: "{ratings}, prikazane bodo od {threshold} dalje",
  shownHeadline:
    "{wouldLiveAgain} od {total} sostanovalcev bi spet živeli s to osebo",
  tagCount: "{label} · {count}",
  topStrengths: "Najpogostejše močne točke",
  improvementsTitle: "Področja za izboljšanje",
  anonymity:
    "Ocena je anonimna in vidna šele, ko oceni tudi druga oseba ali po 14 dneh.",
  // Labels of the stored tag keys (lib/ratings/tags.ts). Public in aggregate.
  strengths: {
    reliable_costs: "Zanesljiv(a) pri stroških",
    clean_tidy: "Čist(a) in urejen(a)",
    respects_quiet: "Spoštuje mir in počitek",
    good_communication: "Dobra komunikacija",
    keeps_agreements: "Upošteva dogovore",
    pleasant: "Prijeten/-tna sostanovalec/-ka",
  },
  // Private: only the rated person sees them, in aggregate.
  improvements: {
    costs: "Stroški",
    cleanliness: "Čistoča",
    noise: "Hrup",
    communication: "Komunikacija",
    agreements: "Dogovori",
    visitors: "Obiski",
  },
  form: {
    title: "Ocena sobivanja z osebo {name}",
    wouldLiveAgain: "Bi spet živel(a) s to osebo? (obvezno)",
    yes: "Da",
    no: "Ne",
    missingAnswer: "Odgovori Da ali Ne.",
    strengthsLegend: "Močne točke (največ {max}, vidne drugim v povzetku)",
    improvementsLegend:
      "Področja za izboljšanje (največ {max}, vidi jih samo ta oseba v povzetku)",
    cancel: "Prekliči",
  },
  chat: {
    sectionLabel: "Ocena sobivanja",
    ownRating: "Tvoja ocena: {answer}",
    privateTag: "{label} (zasebno)",
    saved: "Ocena je shranjena.",
    retry: "Poskusi znova",
    rate: "Oceni",
    edit: "Uredi oceno",
    update: "Posodobi oceno",
    reminder: "Lahko oceniš sobivanje z osebo {name}.",
    closesOn: "Ocenjevanje se zapre {date}.",
    anonymous: "Ocena je anonimna.",
    hidden:
      "Tvoja ocena še ni vidna: prikaže se, ko oceni tudi druga oseba ali po 14 dneh.",
    updateFrom: "Oceno lahko posodobiš od {date} dalje.",
    counted: "Tvoja ocena je upoštevana.",
    save: "Shrani oceno",
    submit: "Oddaj oceno",
  },
  mine: {
    title: "Ocene sostanovalcev",
    intro:
      "Ocenijo te lahko samo osebe, s katerimi imaš potrjeno sobivanje. Drugim jih pokažemo samo, če to vklopiš, in šele od 3 ocen naprej.",
    loading: "Nalaganje ocen …",
    signIn: "Prijava",
    retry: "Poskusi znova",
    noImprovements: "Nihče ni označil področij za izboljšanje.",
    privacyNote:
      "Področja za izboljšanje vidiš samo ti. Nihče ne vidi, kdo je dal katero oceno.",
    visibilityTitle: "Prikaži ocene sostanovalcev",
    visibleOn:
      "Vklopljeno: drugi vidijo povzetek, ko imaš vsaj 3 ocene. Lahko ga kadar koli spet izklopiš.",
    visibleOff:
      "Izklopljeno: ocene se zbirajo zasebno in jih vidiš samo ti. Drugim jih pokažemo šele, ko to vklopiš.",
  },
};

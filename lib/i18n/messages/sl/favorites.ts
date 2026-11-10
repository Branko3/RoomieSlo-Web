// Slovenian "favorites" namespace: the source of truth for the catalog shape.
// Plural entries use pluralForms({ one, two, few, other }) from "../plural".
export const favorites = {
  title: "Priljubljeni oglasi",
  loading: "Nalaganje priljubljenih oglasov ...",
  rowMeta: "{district}, {price} / mesec",
  emptyTitle: "Še nimaš shranjenih oglasov",
  emptyBody: "Ko najdeš zanimiv oglas, ga shrani za pozneje.",
  explore: "Razišči oglase",
  tipTitle: "Majhen nasvet",
  tipBody: "Shranite oglase, ki so vam všeč, in jih primerjajte pozneje.",
  // The heart says what a press will do; the named forms name the listing.
  add: "Dodaj med priljubljene",
  addNamed: "Dodaj {subject} med priljubljene",
  remove: "Odstrani iz priljubljenih",
  removeNamed: "Odstrani {subject} iz priljubljenih",
  save: "Shrani oglas",
  // FavoriteError kinds (lib/favorites/favorites-api.ts).
  errors: {
    permission: "Za shranjevanje priljubljenih se moraš znova prijaviti.",
    gone: "Oglas ne obstaja več, zato ga ni mogoče shraniti.",
    offline: "Ni povezave. Priljubljeni oglas ni bil shranjen.",
    unknown: "Priljubljenih ni bilo mogoče posodobiti.",
  },
};

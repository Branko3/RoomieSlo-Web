// Slovenian "search" namespace: the source of truth for the catalog shape.
// Plural entries use pluralForms({ one, two, few, other }) from "../plural".
import { pluralForms } from "../plural";

export const search = {
  title: "Iskanje sobe",
  filters: "Filtri",
  filtersActive: "Filtri ({count})",
  location: "Lokacija",
  locationPlaceholder: "npr. Ljubljana",
  maxBudget: "Največji proračun",
  results: pluralForms({
    one: "{count} oglas zate",
    two: "{count} oglasa zate",
    few: "{count} oglasi zate",
    other: "{count} oglasov zate",
  }),
  // What the current sort does, said under the result count.
  sortNotes: {
    relevance: "Razvrščeno po združljivosti",
    newest: "Najprej najnovejši",
    "price-asc": "Od najcenejšega",
    "price-desc": "Od najdražjega",
  },
  sortLabel: "Razvrsti:",
  sortOptions: {
    relevance: "Najbolj ustrezni",
    newest: "Najnovejši",
    "price-asc": "Cena naraščajoče",
    "price-desc": "Cena padajoče",
  },
  removeFilter: "Odstrani filter: {filter}",
  upTo: "do {price}",
  clearFilters: "Počisti filtre",
  loadMoreError: "Več oglasov ni bilo mogoče naložiti. Poskusi znova.",
  loadMore: "Naloži več oglasov",
  loadingMore: "Nalaganje …",
  emptyTitle: "Ni zadetkov",
  emptyBody: "Poskusi razširiti lokacijo ali povečati proračun.",
};

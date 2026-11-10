import type { Messages } from "../../types";

export const search: Messages["search"] = {
  title: "Find a room",
  filters: "Filters",
  filtersActive: "Filters ({count})",
  location: "Location",
  locationPlaceholder: "e.g. Ljubljana",
  maxBudget: "Maximum budget",
  results: {
    one: "{count} listing for you",
    other: "{count} listings for you",
  },
  sortNotes: {
    relevance: "Sorted by compatibility",
    newest: "Newest first",
    "price-asc": "Cheapest first",
    "price-desc": "Most expensive first",
  },
  sortLabel: "Sort:",
  sortOptions: {
    relevance: "Most relevant",
    newest: "Newest",
    "price-asc": "Price: low to high",
    "price-desc": "Price: high to low",
  },
  removeFilter: "Remove filter: {filter}",
  upTo: "up to {price}",
  clearFilters: "Clear filters",
  loadMoreError: "Couldn't load more listings. Try again.",
  loadMore: "Load more listings",
  loadingMore: "Loading …",
  emptyTitle: "No results",
  emptyBody: "Try a broader location or a higher budget.",
};

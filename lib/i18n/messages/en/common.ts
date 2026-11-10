import type { Messages } from "../../types";

export const common: Messages["common"] = {
  meta: {
    title: "RoomieSlo — find your home",
    description: "Find a roommate who really suits you.",
  },
  actions: {
    retry: "Try again",
    toListings: "Go to listings",
    closeNotice: "Close notice",
  },
  loading: {
    app: "Loading RoomieSlo ...",
    content: "Loading content ...",
    listings: "Loading listings ...",
  },
  language: {
    label: "Language",
    names: { sl: "Slovenščina", en: "English" },
  },
};

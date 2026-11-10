import type { Messages } from "../../types";

export const ratings: Messages["ratings"] = {
  errors: {
    "signed-out": "Sign in to do this.",
    permission: "You can't rate this person right now.",
    offline: "No connection. Check your internet and try again.",
    invalid: "Answer Yes/No and choose at most 3 tags in each group.",
    window: "Rating isn't open for this living arrangement right now.",
    locked: "You can update your rating only 6 months after your last one.",
    unknown: "Couldn't save the rating. Try again.",
  },
  loadErrors: {
    "signed-out": "Sign in to do this.",
    permission: "You can't rate this person right now.",
    offline: "No connection. Check your internet and try again.",
    unknown: "Couldn't load ratings.",
  },
  count: {
    one: "{count} rating",
    other: "{count} ratings",
  },
  insufficient: "Not enough ratings yet",
  none: "You don't have any ratings yet.",
  belowThreshold: "{ratings}, shown from {threshold} onwards",
  shownHeadline:
    "{wouldLiveAgain} of {total} roommates would live with this person again",
  tagCount: "{label} · {count}",
  topStrengths: "Most common strengths",
  improvementsTitle: "Areas to improve",
  anonymity:
    "Ratings are anonymous and only become visible once the other person has rated too, or after 14 days.",
  strengths: {
    reliable_costs: "Reliable with costs",
    clean_tidy: "Clean and tidy",
    respects_quiet: "Respects quiet and rest",
    good_communication: "Good communication",
    keeps_agreements: "Keeps agreements",
    pleasant: "Pleasant roommate",
  },
  improvements: {
    costs: "Costs",
    cleanliness: "Cleanliness",
    noise: "Noise",
    communication: "Communication",
    agreements: "Agreements",
    visitors: "Visitors",
  },
  form: {
    title: "Rate living with {name}",
    wouldLiveAgain: "Would you live with this person again? (required)",
    yes: "Yes",
    no: "No",
    missingAnswer: "Answer Yes or No.",
    strengthsLegend:
      "Strengths (at most {max}, shown to others in the summary)",
    improvementsLegend:
      "Areas to improve (at most {max}, only this person sees them in the summary)",
    cancel: "Cancel",
  },
  chat: {
    sectionLabel: "Living together rating",
    ownRating: "Your rating: {answer}",
    privateTag: "{label} (private)",
    saved: "Rating saved.",
    retry: "Try again",
    rate: "Rate",
    edit: "Edit rating",
    update: "Update rating",
    reminder: "You can rate living with {name}.",
    closesOn: "Rating closes on {date}.",
    anonymous: "Ratings are anonymous.",
    hidden:
      "Your rating isn't visible yet: it appears once the other person has rated too, or after 14 days.",
    updateFrom: "You can update your rating from {date}.",
    counted: "Your rating has been counted.",
    save: "Save rating",
    submit: "Submit rating",
  },
  mine: {
    title: "Roommate ratings",
    intro:
      "Only people you've confirmed living with can rate you. Others see the ratings only if you turn this on, and only from 3 ratings.",
    loading: "Loading ratings …",
    signIn: "Sign in",
    retry: "Try again",
    noImprovements: "Nobody has marked any areas to improve.",
    privacyNote:
      "Only you see the areas to improve. Nobody can see who gave which rating.",
    visibilityTitle: "Show roommate ratings",
    visibleOn:
      "On: others see the summary once you have at least 3 ratings. You can turn it off again at any time.",
    visibleOff:
      "Off: ratings are collected privately and only you see them. We show them to others only once you turn this on.",
  },
};

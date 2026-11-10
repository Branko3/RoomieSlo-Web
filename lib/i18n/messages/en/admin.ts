import type { Messages } from "../../types";

export const admin: Messages["admin"] = {
  meta: {
    title: "Administration — RoomieSlo",
  },
  title: "Admin dashboard",
  intro: "User reports, newest first.",
  loading: "Loading reports ...",
  signIn: "Sign in",
  home: "Go to the home page",
  filters: "Report status",
  all: "All",
  filterCount: "{label} ({count})",
  status: {
    open: "Open",
    reviewed: "Resolved",
    dismissed: "Dismissed",
  },
  empty: "No reports.",
  emptyFilter: "No reports with this status.",
  reportedLine: "{date} · reported {who}",
  reportedUser: "user {id}",
  reportedDeleted:
    "Deleted user (identity kept for safety purposes; contact the database controller to disclose it)",
  markReviewed: "Mark as resolved",
  reopen: "Reopen",
  dismiss: "Dismiss",
  footnote: "Showing at most the {limit} newest reports.",
  errors: {
    notAdmin: "You don't have administrator rights.",
    signedOut: "Sign in to use the admin dashboard.",
    loadFailed: "Something went wrong while loading reports.",
    updateFailed: "Couldn't change the report's status.",
    conversationFailed: "Couldn't load the conversation.",
    offline: "No connection. Check your internet connection.",
  },
  conversation: {
    show: "Show conversation",
    hide: "Hide conversation",
    logged:
      "Every view of a conversation is logged (administrator, report, time).",
    region: "Reported conversation",
    loading: "Loading the conversation …",
    empty: "The conversation is no longer available.",
    roles: {
      reporter: "Reporter",
      reported: "Reported",
    },
  },
};

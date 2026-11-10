import type { Messages } from "../../types";

export const reports: Messages["reports"] = {
  unavailableTitle: "Can't send a report",
  back: "Back",
  sentTitle: "Report sent",
  sent: "Thank you. Your report has been sent and an administrator will review it.",
  titleListing: "Report listing",
  titleUser: "Report user",
  intro:
    "An administrator reviews every report. The reported person won't find out who reported them.",
  reason: "Reason",
  description: "Additional details (optional)",
  signIn: "Sign in",
  submitting: "Sending...",
  submit: "Send report",
  loading: "Loading ...",
  reasons: {
    inappropriate: "Inappropriate content",
    fake: "Fake profile or listing",
    harassment: "Harassment",
    other: "Other",
  },
  errors: {
    "invalid-user": "Invalid user.",
    "invalid-reason": "Choose a reason for the report.",
    "too-long": "The description can be at most {max} characters long.",
    self: "You can't report yourself.",
    "signed-out": "Sign in to your account to send a report.",
    "missing-user": "This user can no longer be reported.",
    offline: "No connection. Check your internet connection.",
    failed: "The report wasn't sent.",
  },
};

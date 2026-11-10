import type { Messages } from "../../types";

export const profile: Messages["profile"] = {
  title: "Profile",
  deleteAccount: "Delete account",
  verified: "Verified student",
  preview: {
    name: "Amar H.",
    faculty: "FRI, University of Ljubljana",
  },
  age: {
    one: "{count} year old",
    other: "{count} years old",
  },
  loading: "Loading your profile …",
  loadFailedTitle: "Couldn't load your profile",
  retry: "Try again",
  signedOutTitle: "You're not signed in",
  signedOutBody: "Sign in to see and edit your profile.",
  signIn: "Sign in",
  missingTitle: "Your profile isn't ready yet",
  missingBody:
    "Your account doesn't have a profile yet. Refresh the page in a moment or contact support.",
  edit: "Edit",
  saved: "Profile saved.",
  form: {
    title: "Edit profile",
    displayName: "Full name",
    faculty: "Faculty",
    facultyPlaceholder: "FRI, University of Ljubljana",
    age: "Age",
    bio: "About me",
    cancel: "Cancel",
    saving: "Saving …",
    save: "Save",
  },
  validation: {
    "display-name-short": "Enter a name with at least {min} characters.",
    "display-name-long": "The name can be at most {max} characters long.",
    "faculty-long": "The faculty can be at most {max} characters long.",
    "bio-long": "The description can be at most {max} characters long.",
    "age-range": "Age must be a whole number between {min} and {max}.",
  },
  errors: {
    permission:
      "You don't have permission for this profile. Sign out and sign in again.",
    offline: "No connection. Check your internet and try again.",
    unknown: "Couldn't load or save the profile. Try again.",
  },
  availability: {
    title: "Looking for a roommate / room",
    body: "When this is on, your profile appears among recommendations.",
    toggle: "Toggle availability",
  },
};

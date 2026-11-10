import type { Messages } from "../../types";

export const account: Messages["account"] = {
  deletion: {
    back: "Back to profile",
    title: "Delete account",
    final: "Deletion is {strong} and can't be undone.",
    finalStrong: "permanent",
    removedTitle: "Deleted straight away",
    removed: {
      login: "your sign-in (email and password),",
      profile:
        "your profile: name, age, faculty, bio, photo and verification status,",
      content: "your questionnaire answers, favourites and your listings,",
      document: "your enrolment certificate from private storage,",
      requests: "match requests that haven't been answered yet,",
      ratings: "ratings your roommates gave you.",
    },
    keptTitle: "Kept, without your name",
    kept: {
      messages:
        "messages in chats stay with the other person, signed as “Deleted user”; we delete them once they delete their account too,",
      reports:
        "abuse reports you made or that were made against you, for up to 12 months after they're closed,",
      cohabitations:
        "living-together records stay in the other person's history: a current one ends with this month, and an unconfirmed “We live together” declaration is closed as unconfirmed. We delete them once the other person deletes their account too,",
      ratings:
        "ratings you gave stay in the other person's summary without your name, for at most 36 months after you stopped living together,",
      safety:
        "your email and name in a protected safety record: for 30 days, or up to 12 months after a report against you is closed; only the database operator has access.",
    },
    backups:
      "Backups expire within 30 days; until then, deleted data may still be in them.",
    password: "Password",
    confirmLabel: "To confirm, type {phrase}",
    cancel: "Cancel",
    submit: "Delete account permanently",
    submitting: "Deleting …",
    errors: {
      "invalid-confirmation": "To confirm, type “{phrase}”.",
      "missing-password": "Enter your password.",
      "wrong-password": "The password is incorrect.",
      "signed-out":
        "Your session has expired. Sign in again and try once more.",
      reauth:
        "You need to sign in again to delete your account. Enter your password and try again.",
      partial:
        "The deletion wasn't completed. Not all of your data was deleted; write to us and we'll finish it.",
      offline: "No connection. Try again.",
      failed: "We couldn't delete your account. Try again.",
    },
  },
  academic: {
    metaTitle: "Academic verification — RoomieSlo",
    title: "Academic verification",
    intro:
      "Upload your enrolment certificate so other users can see you're a verified student. This lets you verify your status even before the semester officially starts.",
    loading: "Loading …",
    unavailable: "Document upload isn't available right now. Try again later.",
    signedOut: "Sign in to upload your enrolment certificate.",
    signIn: "Sign in",
    existing:
      "Your certificate has already been uploaded and is waiting for review. You can upload a new file to replace it.",
    pick: "Choose a file (PDF, JPG or PNG, max 10 MB)",
    help: "Only you and the admins who check your status can see the document.",
    progress: "Upload progress",
    done: "Uploaded: {fileName}. Your certificate is waiting for an admin to review it.",
    cancel: "Cancel ({percent}%)",
    retry: "Try again",
    submit: "Submit for review",
    continue: "Continue",
    skip: "Skip for now",
    validation: {
      unsupported_type: "Choose a PDF, JPG or PNG file.",
      extension_mismatch: "The file extension doesn't match the file type.",
      empty: "The file is empty. Choose another file.",
      too_large: "The file is too large ({size}). The maximum size is {max}.",
    },
    uploadErrors: {
      permission: "Sign in again to upload.",
      "too-large": "The file is too large to upload.",
      offline: "No connection. Check your internet and try again.",
      aborted: "The upload was cancelled.",
      unknown: "The upload failed. Try again.",
    },
  },
};

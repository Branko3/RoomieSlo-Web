import type { Messages } from "../../types";

// A convenience translation of the Slovenian privacy notice, which prevails.
export const privacy: Messages["privacy"] = {
  title: "Your data",
  translationNotice:
    "This English text is a convenience translation; if it differs from the Slovenian text, the Slovenian text prevails.",
  controller: {
    title: "Data controller",
    body: "The controller of your personal data in the RoomieSlo app is {controller}.",
    contact: "Contact:",
    contactMissing: "A privacy contact hasn't been set yet.",
  },
  data: {
    title: "What data we keep",
    stored:
      "Your profile (name, age, faculty, bio, photo), questionnaire answers, your listings, favourites, matches and messages, living-together records (“We live together”) and roommate ratings, reports you have made, and your enrolment certificate in private storage that only you and the admin can access.",
    access:
      "When abuse is reported, the admin can review the chat linked to the report; every such review is logged. The database operator can access messages for maintenance and to handle abuse. After your account is deleted, your messages stay visible to the other person as “Deleted user”, and reports are kept anonymised for 12 months after they're closed.",
    safety:
      "If an account was reported for abuse, we keep its contact details (email, name) for up to 12 months after the report is closed; otherwise we delete them 30 days after the account is deleted. Only the database operator has access.",
    cookie:
      "We store your chosen interface language in this browser in the roomieslo-locale cookie for one year. It is a functional cookie, contains no personal data and doesn't need your consent.",
  },
  ratings: {
    title: "Roommate ratings",
    basis:
      "We process ratings on the basis of legitimate interest (Article 6(1)(f) GDPR): they help other users choose a roommate more safely. You can only rate someone you have a confirmed living-together record with (“We live together”), once per living-together record.",
    visibility:
      "Showing ratings is off by default: until you turn on “Show roommate ratings” on your profile, ratings are collected privately and only you can see them. Once you turn it on, others see only a summary, for example “3 of 4 roommates would live with this person again”, and up to 3 of the most frequent strengths. We show the summary only once you have at least 3 ratings; until then others see “Not enough ratings yet”. Each person counts once. Only you can see the areas for improvement. Nobody, not even the rated person, can see who gave which rating. Ratings aren't shown on listings.",
    timing:
      "A rating stays hidden until the other person has rated too or 14 days have passed. Only ratings from the last 36 months count; we delete ratings 36 months after the living-together period ends. When you delete your account, we delete the ratings you received; ratings you gave stay in the other person's summary without your name.",
    control:
      "You can turn the display off again at any time. If you don't want us to keep your ratings at all, write to us and we'll delete them. If you think a rating is unfair or that you never lived together,",
    writeTo: "write to",
    noContact: "write to the controller (no contact has been set yet).",
    review:
      "The controller checks the rating and deletes it if it's unfair, without revealing to anyone who gave it.",
  },
  export: {
    title: "Download your data",
    body: "We prepare a JSON file with all the data you can see about yourself, including your living-together records, the ratings you gave, and a summary of the ratings you received (without who gave them).",
    ready: "The file is ready and has been downloaded.",
    preparing: "Preparing ...",
    submit: "Download data",
    fileLabel: "data",
    errors: {
      "signed-out": "Sign in to download your data.",
      offline: "No connection. Try again.",
      failed: "We couldn't prepare your data. Try again.",
    },
    notes: {
      messages:
        "The other person's messages in your chats aren't included; the messages you sent are.",
      documents:
        "Academic documents are listed by name; you can request the files from the admin.",
      ratings:
        "Ratings you received are included only as a summary; who gave which rating isn't included, because that would reveal other people's data.",
    },
  },
  deletion: {
    title: "Account deletion and corrections",
    body: "You can delete your account yourself while signed in: Profile → Delete account. If that doesn't work, write to us and we'll delete it within one month.",
    deleteAccount: "Delete account",
    requestDeletion: "Request deletion by email",
    requestCorrection: "Request a correction",
  },
  requests: {
    subjects: {
      deletion: "Account deletion request",
      correction: "Data correction request",
      other: "Privacy question",
    },
    accountId: "Account ID",
    description: "Describe your request",
  },
};

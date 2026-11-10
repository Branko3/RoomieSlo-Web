import type { Messages } from "../../types";

export const cohabitation: Messages["cohabitation"] = {
  declareAction: "We live together",
  declareTitle: "Do you live together?",
  declareHint:
    "Choose the month you moved in. The other person has to confirm it. Only the two of you can see it. Once you live together, you can rate each other anonymously after two months.",
  startedMonthLabel: "Move-in month",
  endedMonthLabel: "Move-out month",
  submitDeclare: "Send for confirmation",
  confirm: "Confirm",
  decline: "Not true",
  endAction: "We no longer live together",
  endTitle: "Since when have you not lived together?",
  submitEnd: "Confirm the end",
  cancel: "Cancel",
  loading: "Loading living together …",
  signIn: "Sign in",
  retry: "Try again",
  banner: "{name} says you've lived together since {month}.",
  active: "Living together since {month}",
  awaitingPeer:
    "Waiting for {name} to confirm you've lived together since {month}.",
  cooldown: "You can propose again from {date}.",
  attention: "Waiting for your answer about living together",
  monthSpan: "{from} – {to}",
  monthSince: "since {from}",
  announcements: {
    declare: "Sent for confirmation.",
    confirm: "Confirmed.",
    decline: "Marked as not true.",
    end: "Living together has ended.",
  },
  status: {
    active: "Living together",
    ended: "No longer living together",
    declined: "Not confirmed",
    awaitingPeer: "Waiting for confirmation",
    awaitingMe: "Waiting for your answer",
  },
  errors: {
    "signed-out": "Sign in to do this.",
    permission: "This can't be done in this chat right now.",
    offline: "No connection. Check your internet and try again.",
    conflict: "Things changed in the meantime. Showing the latest state.",
    cooldown: "After a decline you can propose again only after {days} days.",
    "invalid-month":
      "Choose a month that isn't in the future or before your match started.",
    unknown: "Couldn't do that. Try again.",
  },
  loadErrors: {
    "signed-out": "Sign in to do this.",
    permission: "This can't be done in this chat right now.",
    offline: "No connection. Check your internet and try again.",
    unknown: "Couldn't load living together details.",
  },
  mine: {
    title: "Living together",
    intro: "Only you and the other person can see this.",
    suggestion:
      "You live together. Do you want to turn off “Looking for a roommate / room” so your profile no longer appears among recommendations?",
    notNow: "Not now",
    turnOff: "Turn off",
    empty:
      "You haven't recorded living with anyone yet. In the chat with the person you live with, choose “We live together”.",
    openChat: "Open chat",
    unknownPeer: "User",
    openChatWith: "Open chat with {name}",
  },
};

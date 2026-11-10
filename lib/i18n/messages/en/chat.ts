import type { Messages } from "../../types";

export const chat: Messages["chat"] = {
  list: {
    title: "Matches and chats",
    recommendedTitle: "Recommended profiles",
    recommendedBody: "Based on your answers",
    recommendedLink: "View",
  },
  conversation: {
    back: "Back to chats",
    unavailable: "Chat isn't available right now.",
    opening: "Opening the chat …",
    failedTitle: "Couldn't open the chat",
    errors: {
      offline: "No connection. Couldn't open the chat.",
      failed: "Couldn't open the chat.",
    },
    signedOutTitle: "You're not signed in",
    signedOutBody: "Sign in to see this chat.",
    signIn: "Sign in",
    notFoundTitle: "Chat not available",
    notFoundBody: "This conversation doesn't exist or you're not part of it.",
    toChats: "Go to chats",
    verified: "Verified student",
    unknownUser: "User",
    peerListings: "This person's listings",
    listingPrice: "€{price} / month",
    openRequests: "Open requests",
    region: "Conversation with {name}",
    deletedPeer: "This user has deleted their account.",
    notices: {
      pendingIncoming:
        "This person sent you a match request. Accept it in your chats to open the conversation.",
      pendingOutgoing:
        "The request is still waiting for a reply. The conversation opens once the other person accepts it.",
      rejected:
        "The match request was declined, so the conversation isn't available.",
    },
  },
  messages: {
    loading: "Loading messages …",
    errors: {
      "signed-out": "Sign in to see messages.",
      offline: "No connection. Couldn't load messages.",
      failed: "Something went wrong while loading messages.",
    },
    empty: "No messages yet. Say hello to {name}.",
    log: "Messages with {name}",
    you: "You",
    sending: "Sending …",
    notSent: "Not sent",
    discard: "Discard",
    today: "Today",
    yesterday: "Yesterday",
    delivery: {
      sent: "Sent",
      delivered: "Delivered",
      read: "Read",
    },
  },
  composer: {
    label: "Message",
    placeholder: "Write a message …",
    send: "Send",
    errors: {
      "signed-out": "Sign in to send messages.",
      "not-allowed": "You can't write in this conversation.",
      "too-long": "A message can be at most {max} characters long.",
      offline: "No connection. The message wasn't sent.",
      failed: "Couldn't send the message.",
      "already-sent": "The message has already been sent.",
    },
  },
  live: {
    waiting: "Live connection lost. Retrying in {seconds} s.",
    disconnected:
      "Live connection lost. New messages will appear once the connection is back.",
  },
  safety: {
    menu: "Safety: report or block",
    report: "Report",
    block: "Block",
    unblock: "Unblock",
    cancel: "Cancel",
    blocked:
      "You've blocked this person. You can't message each other until you unblock them.",
    confirm:
      "Block this person? You won't be able to send each other messages or new match requests.",
    errors: {
      "signed-out": "Sign in to do this.",
      self: "Couldn't complete the action. Try again.",
      offline: "No connection. Try again.",
      failed: "Couldn't complete the action. Try again.",
    },
  },
};

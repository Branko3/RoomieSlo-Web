import type { Messages } from "../../types";

export const errors: Messages["errors"] = {
  page: {
    title: "Something went wrong",
    body: "You can try loading the content again.",
  },
  notFound: {
    title: "This page doesn't exist",
    body: "Check the link or go back to the listings.",
  },
  offline: {
    title: "You're offline",
    body: "Check your internet connection. Once you're back online, try again.",
  },
  permission: {
    title: "You don't have access to this content",
    body: "Your account isn't allowed to view this content.",
    action: "Go to content you can view",
  },
  authRequired: {
    title: "Sign in required",
    body: "Sign in to your account to view this content.",
    action: "Go to sign in",
  },
  load: {
    title: "The content couldn't be loaded",
    body: "Something went wrong. Try again or go back to the listings.",
  },
  favoritesLoad:
    "Your favourites couldn't be loaded from the server. Showing the ones saved in this browser.",
};

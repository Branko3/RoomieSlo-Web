import type { Messages } from "../../types";

export const favorites: Messages["favorites"] = {
  title: "Favourite listings",
  loading: "Loading favourite listings ...",
  rowMeta: "{district}, {price} / month",
  emptyTitle: "You haven't saved any listings yet",
  emptyBody: "When you find an interesting listing, save it for later.",
  explore: "Browse listings",
  tipTitle: "A small tip",
  tipBody: "Save the listings you like and compare them later.",
  add: "Add to favourites",
  addNamed: "Add {subject} to favourites",
  remove: "Remove from favourites",
  removeNamed: "Remove {subject} from favourites",
  save: "Save listing",
  errors: {
    permission: "Sign in again to save favourites.",
    gone: "This listing no longer exists, so it can't be saved.",
    offline: "No connection. The favourite wasn't saved.",
    unknown: "Couldn't update your favourites.",
  },
};

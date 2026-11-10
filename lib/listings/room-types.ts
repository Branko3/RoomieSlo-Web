/** Room types offered when publishing (Android `VRSTE_NASTANITVE`); stored as text. */
export const ROOM_TYPES = [
  "soba",
  "garsonjera",
  "deljeno stanovanje",
  "celo stanovanje",
] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

/** Catalog key (`m.listings.roomTypes`) for each stored room type. */
export const ROOM_TYPE_KEYS = {
  soba: "room",
  garsonjera: "studio",
  "deljeno stanovanje": "sharedFlat",
  "celo stanovanje": "wholeFlat",
} as const satisfies Record<RoomType, string>;

export type RoomTypeKey = (typeof ROOM_TYPE_KEYS)[RoomType];

export function isRoomType(value: string): value is RoomType {
  return (ROOM_TYPES as readonly string[]).includes(value);
}

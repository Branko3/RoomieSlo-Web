import type { AuthSession, Row } from "./types";

export type Listing = {
  id: string;
  ownerId: string;
  title: string;
  district: string;
  location: string;
  price: number;
  available: string;
  availableFrom: string | null;
  roomType: string;
  details: string;
  image: string;
  isFilled: boolean;
  createdAt: string;
};

export type Profile = Pick<Row<"profiles">, "id" | "display_name" | "academic_status_verified" | "is_available" | "created_at" | "age" | "faculty" | "bio" | "avatar_url">;
export type Favorite = Row<"favorites">;
export type Match = Row<"matches">;
export type Message = Row<"messages">;
export type QuestionnaireAnswer = Row<"questionnaire_answers">;
export type Report = Row<"reports">;

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid ${field}: expected a non-empty string`);
  return value;
}

function requiredNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid ${field}: expected a finite number`);
  return number;
}

export function mapListing(row: Row<"listings">): Listing {
  const id = requiredString(row.id, "listings.id");
  const location = requiredString(row.location, "listings.location");
  const createdAt = requiredString(row.created_at, "listings.created_at");
  const price = requiredNumber(row.price_per_month, "listings.price_per_month");
  if (typeof row.is_filled !== "boolean") throw new Error(`Invalid listings.is_filled`);
  return {
    id,
    ownerId: requiredString(row.owner_id, "listings.owner_id"),
    title: row.title || location,
    district: row.district || location,
    location,
    price,
    available: row.available_from ?? "po dogovoru",
    availableFrom: row.available_from,
    roomType: row.room_type || "soba",
    details: [
      row.size_sqm === null ? null : `${row.size_sqm} m²`,
      row.flatmates_count ? `${row.flatmates_count} sostanovalcev` : null,
      row.bills_included ? "stroški vključeni" : null,
    ].filter(Boolean).join(" · "),
    image: row.photo_url || "🏠",
    isFilled: row.is_filled,
    createdAt,
  };
}

export function mapProfile(row: Row<"profiles">): Profile {
  requiredString(row.id, "profiles.id");
  requiredString(row.created_at, "profiles.created_at");
  if (typeof row.academic_status_verified !== "boolean" || typeof row.is_available !== "boolean") {
    throw new Error("Invalid profiles boolean field");
  }
  return row;
}

export function mapFavorite(row: Row<"favorites">): Favorite {
  requiredString(row.profile_id, "favorites.profile_id");
  requiredString(row.listing_id, "favorites.listing_id");
  requiredString(row.created_at, "favorites.created_at");
  return row;
}

export function mapMatch(row: Row<"matches">): Match {
  requiredString(row.id, "matches.id");
  requiredString(row.user_id_a, "matches.user_id_a");
  requiredString(row.user_id_b, "matches.user_id_b");
  requiredString(row.created_at, "matches.created_at");
  if (!["pending", "accepted", "rejected"].includes(row.status)) throw new Error("Invalid matches.status");
  return row;
}

export function mapMessage(row: Row<"messages">): Message {
  requiredString(row.id, "messages.id");
  requiredString(row.match_id, "messages.match_id");
  requiredString(row.sender_id, "messages.sender_id");
  requiredString(row.body, "messages.body");
  requiredString(row.sent_at, "messages.sent_at");
  if (!["sent", "delivered", "read"].includes(row.delivery_status)) throw new Error("Invalid messages.delivery_status");
  return row;
}

export function mapQuestionnaireAnswer(row: Row<"questionnaire_answers">): QuestionnaireAnswer {
  requiredString(row.id, "questionnaire_answers.id");
  requiredString(row.profile_id, "questionnaire_answers.profile_id");
  requiredString(row.question_id, "questionnaire_answers.question_id");
  requiredNumber(row.value, "questionnaire_answers.value");
  requiredNumber(row.weight, "questionnaire_answers.weight");
  return row;
}

export function mapReport(row: Row<"reports">): Report {
  requiredString(row.id, "reports.id");
  requiredString(row.reporter_id, "reports.reporter_id");
  requiredString(row.reported_id, "reports.reported_id");
  requiredString(row.reason, "reports.reason");
  requiredString(row.created_at, "reports.created_at");
  if (!["open", "reviewed", "dismissed"].includes(row.status)) throw new Error("Invalid reports.status");
  return row;
}

export function mapAuthSession(session: AuthSession | null) {
  return session ? { userId: requiredString(session.user.id, "auth.user.id"), email: session.user.email ?? null, expiresAt: session.expires_at ?? null } : null;
}

export function listingInsert(input: { ownerId: string; location: string; price: number; description?: string; title?: string; roomType?: string; district?: string; availableFrom?: string | null; photoUrl?: string }) {
  if (!input.ownerId || !input.location.trim() || !Number.isFinite(input.price) || input.price < 0) throw new Error("Invalid listing input");
  return {
    owner_id: input.ownerId,
    location: input.location.trim(),
    price_per_month: input.price,
    description: input.description?.trim() ?? "",
    title: input.title?.trim() ?? "",
    room_type: input.roomType?.trim() ?? "",
    district: input.district?.trim() ?? "",
    available_from: input.availableFrom ?? null,
    photo_url: input.photoUrl?.trim() ?? "",
  };
}

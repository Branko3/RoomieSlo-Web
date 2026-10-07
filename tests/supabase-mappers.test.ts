import { describe, expect, it } from "vitest";
import {
  listingInsert,
  mapAuthSession,
  mapFavorite,
  mapListing,
  mapMatch,
  mapMessage,
  mapProfile,
  mapQuestionnaireAnswer,
  mapReport,
} from "../lib/supabase/mappers";
import type { Row } from "../lib/supabase/types";

const row: Row<"listings"> = {
  id: "listing-1",
  owner_id: "owner-1",
  location: "Ljubljana - Bežigrad",
  price_per_month: 320,
  description: "Opis",
  is_filled: false,
  version: 1,
  created_at: "2026-01-01T00:00:00Z",
  title: "Soba",
  room_type: "soba",
  district: "Bežigrad",
  available_from: null,
  size_sqm: 16,
  deposit: null,
  bills_included: true,
  furnished: true,
  flatmates_count: 2,
  photo_url: "",
};

const profile: Row<"profiles"> = {
  id: "profile-1",
  display_name: "Ana",
  academic_status_verified: true,
  is_available: true,
  created_at: "2026-01-01T00:00:00Z",
  age: null,
  faculty: "FRI",
  bio: "",
  avatar_url: "",
};

describe("Supabase contract mappers", () => {
  it("preserves listing identifiers, status, nullable dates, and created_at", () => {
    expect(mapListing(row)).toMatchObject({
      id: "listing-1",
      ownerId: "owner-1",
      price: 320,
      available: "po dogovoru",
      availableFrom: null,
      isFilled: false,
      createdAt: row.created_at,
    });
  });

  it("rejects incomplete rows instead of returning an empty domain object", () => {
    expect(() => mapListing({ ...row, id: "" })).toThrow("listings.id");
  });

  it("converts web form values to the Android-compatible insert shape", () => {
    expect(listingInsert({ ownerId: "owner-1", location: " Ljubljana ", price: 450 })).toEqual({
      owner_id: "owner-1",
      location: "Ljubljana",
      price_per_month: 450,
      description: "",
      title: "",
      room_type: "",
      district: "",
      available_from: null,
      photo_url: "",
    });
  });

  it("represents an unauthenticated session explicitly", () => {
    expect(mapAuthSession(null)).toBeNull();
  });

  it("maps authenticated session identity without exposing unrelated session fields", () => {
    expect(mapAuthSession({
      access_token: "access",
      refresh_token: "refresh",
      expires_at: 123,
      user: { id: "user-1", email: "user@example.com", user_metadata: { role: "student" } },
    })).toEqual({
      userId: "user-1",
      email: "user@example.com",
      expiresAt: 123,
    });
  });

  it("rejects malformed listing state and invalid listing form values", () => {
    expect(() => mapListing({ ...row, created_at: "" })).toThrow("listings.created_at");
    expect(() => mapListing({ ...row, is_filled: "false" as never })).toThrow("listings.is_filled");
    expect(() => listingInsert({ ownerId: "", location: "Ljubljana", price: 400 })).toThrow("Invalid listing input");
    expect(() => listingInsert({ ownerId: "owner-1", location: " ", price: 400 })).toThrow("Invalid listing input");
    expect(() => listingInsert({ ownerId: "owner-1", location: "Ljubljana", price: -1 })).toThrow("Invalid listing input");
  });

  it("validates profile, favorite, questionnaire, match, message, and report rows", () => {
    expect(mapProfile(profile)).toBe(profile);
    expect(mapFavorite({
      profile_id: "profile-1",
      listing_id: "listing-1",
      created_at: row.created_at,
    })).toMatchObject({ profile_id: "profile-1" });
    expect(mapQuestionnaireAnswer({
      id: "answer-1",
      profile_id: "profile-1",
      question_id: "cleanliness",
      value: 4,
      weight: 1,
    })).toMatchObject({ value: 4 });
    expect(mapMatch({
      id: "match-1",
      user_id_a: "user-a",
      user_id_b: "user-b",
      status: "pending",
      version: 1,
      created_at: row.created_at,
    })).toMatchObject({ status: "pending" });
    expect(mapMessage({
      id: "message-1",
      match_id: "match-1",
      sender_id: "user-a",
      body: "Živjo",
      delivery_status: "sent",
      sent_at: row.created_at,
    })).toMatchObject({ delivery_status: "sent" });
    expect(mapReport({
      id: "report-1",
      reporter_id: "user-a",
      reported_id: "user-b",
      reason: "spam",
      description: "",
      status: "open",
      created_at: row.created_at,
    })).toMatchObject({ status: "open" });
  });

  it("rejects invalid status and required values for every validated table", () => {
    expect(() => mapProfile({ ...profile, id: "" })).toThrow("profiles.id");
    expect(() => mapFavorite({ profile_id: "", listing_id: "listing-1", created_at: row.created_at })).toThrow();
    expect(() => mapQuestionnaireAnswer({
      id: "answer-1",
      profile_id: "profile-1",
      question_id: "question-1",
      value: Number.NaN,
      weight: 1,
    })).toThrow();
    expect(() => mapMatch({
      id: "match-1",
      user_id_a: "user-a",
      user_id_b: "user-b",
      status: "invalid" as Row<"matches">["status"],
      version: 1,
      created_at: row.created_at,
    })).toThrow("matches.status");
    expect(() => mapMessage({
      id: "message-1",
      match_id: "match-1",
      sender_id: "user-a",
      body: "x",
      delivery_status: "invalid" as Row<"messages">["delivery_status"],
      sent_at: row.created_at,
    })).toThrow("messages.delivery_status");
    expect(() => mapReport({
      id: "report-1",
      reporter_id: "user-a",
      reported_id: "user-b",
      reason: "spam",
      description: "",
      status: "invalid" as Row<"reports">["status"],
      created_at: row.created_at,
    })).toThrow("reports.status");
  });
});

import { describe, expect, it } from "vitest";
import {
  photoAlt,
  PHOTO_PLACEHOLDER,
  safePhotoUrl,
} from "../lib/listings/listing-photo";
import { mapListing } from "../lib/supabase/mappers";
import type { Row } from "../lib/supabase/types";

describe("safePhotoUrl", () => {
  it.each([
    "https://abc.supabase.co/storage/v1/object/public/listings/a.jpg",
    "https://images.example.com/soba.png?w=800",
    "  https://example.com/a b.jpg  ",
  ])("accepts the https URL %s", (value) => {
    const url = safePhotoUrl(value);
    expect(url).not.toBeNull();
    expect(url).toMatch(/^https:\/\//);
  });

  it("normalizes the accepted URL", () => {
    expect(safePhotoUrl(" https://example.com/a b.jpg ")).toBe(
      "https://example.com/a%20b.jpg",
    );
    expect(safePhotoUrl("HTTPS://Example.com/x.jpg")).toBe(
      "https://example.com/x.jpg",
    );
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["null", null],
    ["undefined", undefined],
    ["the emoji placeholder", PHOTO_PLACEHOLDER],
    ["plain http", "http://example.com/a.jpg"],
    ["javascript", "javascript:alert(1)"],
    ["data URL", "data:image/png;base64,AAAA"],
    ["protocol-relative", "//example.com/a.jpg"],
    ["relative path", "/images/a.jpg"],
    ["malformed", "https://"],
    ["credentials", "https://user:pass@example.com/a.jpg"],
    ["other scheme", "ftp://example.com/a.jpg"],
  ])("rejects %s", (_label, value) => {
    expect(safePhotoUrl(value)).toBeNull();
  });
});

describe("photoAlt", () => {
  it("describes the photo with the title and district", () => {
    expect(photoAlt({ title: "Svetla soba", district: "Vič" })).toBe(
      "Fotografija oglasa: Svetla soba, Vič",
    );
  });

  it("does not repeat the place when the district equals the title", () => {
    expect(photoAlt({ title: "Ljubljana", district: "Ljubljana" })).toBe(
      "Fotografija oglasa: Ljubljana",
    );
    expect(photoAlt({ title: "Soba", district: "" })).toBe(
      "Fotografija oglasa: Soba",
    );
  });
});

describe("listing photo data flow", () => {
  const row: Row<"listings"> = {
    id: "listing-1",
    owner_id: "owner-1",
    location: "Ljubljana",
    price_per_month: 400,
    description: "",
    is_filled: false,
    version: 1,
    created_at: "2026-10-01T00:00:00Z",
    title: "Soba",
    room_type: "soba",
    district: "Center",
    available_from: null,
    size_sqm: null,
    deposit: null,
    bills_included: false,
    furnished: false,
    flatmates_count: 0,
    photo_url: "",
  };

  it("uses the stored photo URL when it is safe", () => {
    const listing = mapListing({
      ...row,
      photo_url: "https://cdn.example.com/soba.jpg",
    });
    expect(safePhotoUrl(listing.image)).toBe(
      "https://cdn.example.com/soba.jpg",
    );
  });

  it("falls back to the placeholder for listings without a usable photo", () => {
    expect(safePhotoUrl(mapListing(row).image)).toBeNull();
    expect(
      safePhotoUrl(
        mapListing({ ...row, photo_url: "javascript:alert(1)" }).image,
      ),
    ).toBeNull();
  });
});

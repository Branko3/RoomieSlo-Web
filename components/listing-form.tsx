"use client";

import { useState } from "react";
import {
  digitsOnly,
  DISTRICTS,
  LISTING_LIMITS,
  ROOM_TYPES,
  validateListingDraft,
  type ListingDraft,
  type ListingField,
  type ListingValues,
} from "../lib/listings/listing-form";

const NUMERIC_FIELDS: ListingField[] = [
  "price",
  "sizeSqm",
  "deposit",
  "flatmates",
];

/**
 * Listing form shared by create (and later edit). Validation runs on submit;
 * the first invalid field is focused and every error is linked to its input.
 */
export function ListingForm({
  initialDraft,
  submitLabel,
  onSubmit,
}: {
  initialDraft: ListingDraft;
  submitLabel: string;
  onSubmit: (values: ListingValues) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState<ListingDraft>(initialDraft);
  const [errors, setErrors] = useState<Partial<Record<ListingField, string>>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function set<K extends ListingField>(field: K, value: ListingDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function text(field: ListingField) {
    return {
      id: `listing-${field}`,
      name: field,
      value: String(draft[field]),
      disabled: saving,
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": errors[field] ? `listing-${field}-error` : undefined,
      onChange: (
        event: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) =>
        set(
          field,
          (NUMERIC_FIELDS.includes(field)
            ? digitsOnly(event.target.value)
            : event.target.value) as never,
        ),
    };
  }

  const error = (field: ListingField) =>
    errors[field] && (
      <small className="field-error" id={`listing-${field}-error`}>
        {errors[field]}
      </small>
    );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const validation = validateListingDraft(draft);
    if (!validation.ok) {
      setErrors(validation.errors);
      const first = Object.keys(validation.errors)[0];
      form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    setSaveError(null);
    setSaving(true);
    const failure = await onSubmit(validation.values);
    if (failure) {
      setSaveError(failure);
      setSaving(false);
    }
  }

  return (
    <form className="listing-form" onSubmit={submit} noValidate>
      <fieldset>
        <legend>Osnovni podatki</legend>
        <label htmlFor="listing-title">Naslov</label>
        <input
          {...text("title")}
          placeholder="Svetla soba blizu FRI"
          maxLength={LISTING_LIMITS.titleMax + 20}
        />
        {error("title")}

        <label htmlFor="listing-location">Lokacija *</label>
        <input
          {...text("location")}
          required
          placeholder="Ljubljana"
          autoComplete="address-level2"
        />
        {error("location")}

        <div className="form-row">
          <div>
            <label htmlFor="listing-district">Četrt</label>
            <select {...text("district")}>
              <option value="">Ni izbrano</option>
              {DISTRICTS.map((district) => (
                <option key={district}>{district}</option>
              ))}
            </select>
            {error("district")}
          </div>
          <div>
            <label htmlFor="listing-roomType">Vrsta nastanitve</label>
            <select {...text("roomType")}>
              <option value="">Ni izbrano</option>
              {ROOM_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            {error("roomType")}
          </div>
        </div>

        <label htmlFor="listing-description">Opis</label>
        <textarea {...text("description")} rows={5} />
        <small className="field-hint">
          {draft.description.trim().length}/{LISTING_LIMITS.descriptionMax}
        </small>
        {error("description")}
      </fieldset>

      <fieldset>
        <legend>Cena in podrobnosti</legend>
        <div className="form-row">
          <div>
            <label htmlFor="listing-price">Cena na mesec (€) *</label>
            <input {...text("price")} inputMode="numeric" required />
            {error("price")}
          </div>
          <div>
            <label htmlFor="listing-deposit">Varščina (€)</label>
            <input {...text("deposit")} inputMode="numeric" />
            {error("deposit")}
          </div>
        </div>
        <div className="form-row">
          <div>
            <label htmlFor="listing-sizeSqm">Velikost (m²)</label>
            <input {...text("sizeSqm")} inputMode="numeric" />
            {error("sizeSqm")}
          </div>
          <div>
            <label htmlFor="listing-flatmates">Število sostanovalcev</label>
            <input {...text("flatmates")} inputMode="numeric" />
            {error("flatmates")}
          </div>
        </div>
        <label htmlFor="listing-availableFrom">Vselitev</label>
        <input {...text("availableFrom")} type="date" />
        <small className="field-hint">Prazno pomeni „po dogovoru“.</small>
        {error("availableFrom")}

        <label className="checkbox-row">
          <input
            type="checkbox"
            name="billsIncluded"
            checked={draft.billsIncluded}
            disabled={saving}
            onChange={(event) => set("billsIncluded", event.target.checked)}
          />
          Stroški so vključeni v ceno
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="furnished"
            checked={draft.furnished}
            disabled={saving}
            onChange={(event) => set("furnished", event.target.checked)}
          />
          Opremljeno
        </label>
      </fieldset>

      {saveError && (
        <p className="error-message" role="alert">
          {saveError}
        </p>
      )}
      <button className="button full-button" type="submit" disabled={saving}>
        {saving ? "Shranjevanje …" : submitLabel}
      </button>
    </form>
  );
}

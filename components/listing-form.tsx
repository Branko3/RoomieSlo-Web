"use client";

import { useState } from "react";
import { useI18n } from "../lib/i18n/provider";
import {
  digitsOnly,
  DISTRICTS,
  LISTING_LIMITS,
  ROOM_TYPES,
  validateListingDraft,
  type ListingDraft,
  type ListingErrors,
  type ListingField,
  type ListingSubmitFailure,
  type ListingValues,
} from "../lib/listings/listing-form";
import { roomTypeLabel } from "../lib/listings/format";

const NUMERIC_FIELDS: ListingField[] = [
  "price",
  "sizeSqm",
  "deposit",
  "flatmates",
];

/**
 * Listing form shared by create and edit. Validation runs on submit; the
 * first invalid field is focused and every error is linked to its input.
 * `onSubmit` resolves to `null` on success or to the failure to show.
 */
export function ListingForm({
  initialDraft,
  submitLabel,
  onSubmit,
}: {
  initialDraft: ListingDraft;
  submitLabel: string;
  onSubmit: (values: ListingValues) => Promise<ListingSubmitFailure | null>;
}) {
  const { m, format } = useI18n();
  const text = m.listings.form;
  const [draft, setDraft] = useState<ListingDraft>(initialDraft);
  // Codes, not text, so the messages follow a language switch.
  const [errors, setErrors] = useState<ListingErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ListingSubmitFailure | null>(null);

  function set<K extends ListingField>(field: K, value: ListingDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function control(field: ListingField) {
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

  const error = (field: ListingField) => {
    const fieldError = errors[field];
    return (
      fieldError && (
        <small className="field-error" id={`listing-${field}-error`}>
          {format(text.errors[fieldError.code], { max: fieldError.max ?? "" })}
        </small>
      )
    );
  };

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
        <legend>{text.basics}</legend>
        <label htmlFor="listing-title">{text.title}</label>
        <input
          {...control("title")}
          placeholder={text.titlePlaceholder}
          maxLength={LISTING_LIMITS.titleMax + 20}
        />
        {error("title")}

        <label htmlFor="listing-location">{text.location}</label>
        <input
          {...control("location")}
          required
          placeholder={text.locationPlaceholder}
          autoComplete="address-level2"
        />
        {error("location")}

        <div className="form-row">
          <div>
            <label htmlFor="listing-district">{text.district}</label>
            <select {...control("district")}>
              <option value="">{text.notSelected}</option>
              {DISTRICTS.map((district) => (
                <option key={district}>{district}</option>
              ))}
            </select>
            {error("district")}
          </div>
          <div>
            <label htmlFor="listing-roomType">{text.roomType}</label>
            <select {...control("roomType")}>
              <option value="">{text.notSelected}</option>
              {ROOM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {roomTypeLabel(type, m.listings)}
                </option>
              ))}
            </select>
            {error("roomType")}
          </div>
        </div>

        <label htmlFor="listing-description">{text.description}</label>
        <textarea {...control("description")} rows={5} />
        <small className="field-hint">
          {draft.description.trim().length}/{LISTING_LIMITS.descriptionMax}
        </small>
        {error("description")}
      </fieldset>

      <fieldset>
        <legend>{text.priceSection}</legend>
        <div className="form-row">
          <div>
            <label htmlFor="listing-price">{text.price}</label>
            <input {...control("price")} inputMode="numeric" required />
            {error("price")}
          </div>
          <div>
            <label htmlFor="listing-deposit">{text.deposit}</label>
            <input {...control("deposit")} inputMode="numeric" />
            {error("deposit")}
          </div>
        </div>
        <div className="form-row">
          <div>
            <label htmlFor="listing-sizeSqm">{text.size}</label>
            <input {...control("sizeSqm")} inputMode="numeric" />
            {error("sizeSqm")}
          </div>
          <div>
            <label htmlFor="listing-flatmates">{text.flatmates}</label>
            <input {...control("flatmates")} inputMode="numeric" />
            {error("flatmates")}
          </div>
        </div>
        <label htmlFor="listing-availableFrom">{text.moveIn}</label>
        <input {...control("availableFrom")} type="date" />
        <small className="field-hint">{text.moveInHint}</small>
        {error("availableFrom")}

        <label className="checkbox-row">
          <input
            type="checkbox"
            name="billsIncluded"
            checked={draft.billsIncluded}
            disabled={saving}
            onChange={(event) => set("billsIncluded", event.target.checked)}
          />
          {text.billsIncluded}
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="furnished"
            checked={draft.furnished}
            disabled={saving}
            onChange={(event) => set("furnished", event.target.checked)}
          />
          {text.furnished}
        </label>
      </fieldset>

      {saveError && (
        <p className="error-message" role="alert">
          {saveError === "conflict"
            ? m.listings.edit.conflict
            : text.saveErrors[saveError]}
        </p>
      )}
      <button className="button full-button" type="submit" disabled={saving}>
        {saving ? text.saving : submitLabel}
      </button>
    </form>
  );
}

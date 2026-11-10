"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  draftFromProfile,
  fetchOwnProfile,
  initialsFor,
  PROFILE_LIMITS,
  updateOwnProfile,
  validateProfileDraft,
  type OwnProfileResult,
  type ProfileClient,
  type ProfileDraft,
  type ProfileField,
  type ProfileFieldError,
  type ProfileRequestError,
} from "../lib/profile/own-profile";
import { useI18n } from "../lib/i18n/provider";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { VerifiedIcon } from "./icons";

export const OWN_PROFILE_QUERY_KEY = ["profile", "own"] as const;

/** The `{min}`/`{max}` values of each validation message. */
const validationLimits: Record<ProfileFieldError, Record<string, number>> = {
  "display-name-short": { min: PROFILE_LIMITS.displayNameMin },
  "display-name-long": { max: PROFILE_LIMITS.displayNameMax },
  "faculty-long": { max: PROFILE_LIMITS.facultyMax },
  "bio-long": { max: PROFILE_LIMITS.bioMax },
  "age-range": { min: PROFILE_LIMITS.ageMin, max: PROFILE_LIMITS.ageMax },
};

function PreviewHeader() {
  const { m, plural } = useI18n();
  return (
    <section className="profile-header">
      <span className="avatar avatar-large">AH</span>
      <div>
        <h2>{m.profile.preview.name}</h2>
        <p>
          {m.profile.preview.faculty} · {plural(m.profile.age, 22)}
        </p>
        <span className="verified-badge">
          <VerifiedIcon size={16} />
          {m.profile.verified}
        </span>
      </div>
    </section>
  );
}

export function OwnProfileSection({ configured }: { configured: boolean }) {
  if (!configured) return <PreviewHeader />;
  return <ConnectedProfile />;
}

function ConnectedProfile() {
  const { m } = useI18n();
  const t = m.profile;
  const client = useMemo(
    () => createSupabaseBrowserClient() as unknown as ProfileClient,
    [],
  );
  const query = useQuery<OwnProfileResult, ProfileRequestError>({
    queryKey: OWN_PROFILE_QUERY_KEY,
    queryFn: () => fetchOwnProfile(client),
  });

  if (query.isPending) {
    return (
      <section className="profile-header" aria-busy="true">
        <span className="avatar avatar-large" aria-hidden="true" />
        <p role="status">{t.loading}</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="profile-card" role="alert">
        <div>
          <b>{t.loadFailedTitle}</b>
          <p>{t.errors[query.error.kind]}</p>
        </div>
        <button
          className="button button-outline"
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          {t.retry}
        </button>
      </section>
    );
  }

  const result = query.data;
  if (result.status === "signed-out") {
    return (
      <section className="profile-card">
        <div>
          <b>{t.signedOutTitle}</b>
          <p>{t.signedOutBody}</p>
        </div>
        <Link className="button" href="/login">
          {t.signIn}
        </Link>
      </section>
    );
  }

  if (result.status === "missing") {
    return (
      <section className="profile-card" role="alert">
        <div>
          <b>{t.missingTitle}</b>
          <p>{t.missingBody}</p>
        </div>
      </section>
    );
  }

  return (
    <ProfileHeader client={client} userId={result.userId} result={result} />
  );
}

function ProfileHeader({
  client,
  userId,
  result,
}: {
  client: ProfileClient;
  userId: string;
  result: Extract<OwnProfileResult, { status: "ready" }>;
}) {
  const { profile } = result;
  const { m, format, plural } = useI18n();
  const t = m.profile;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(() =>
    draftFromProfile(profile),
  );
  const [errors, setErrors] = useState<
    Partial<Record<ProfileField, ProfileFieldError>>
  >({});
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (values: Parameters<typeof updateOwnProfile>[2]) =>
      updateOwnProfile(client, userId, values),
    onSuccess: (updated) => {
      const next: OwnProfileResult = {
        status: "ready",
        userId,
        profile: updated,
      };
      queryClient.setQueryData(OWN_PROFILE_QUERY_KEY, next);
      setEditing(false);
      setSaved(true);
    },
  });

  function startEditing() {
    setDraft(draftFromProfile(profile));
    setErrors({});
    setSaved(false);
    mutation.reset();
    setEditing(true);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const validation = validateProfileDraft(draft);
    if (!validation.ok) {
      setErrors(validation.errors);
      const first = Object.keys(validation.errors)[0];
      event.currentTarget
        .querySelector<HTMLElement>(`[name="${first}"]`)
        ?.focus();
      return;
    }
    setErrors({});
    mutation.mutate(validation.values);
  }

  const update =
    (field: ProfileField) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((current) => ({ ...current, [field]: event.target.value }));

  const details = [
    profile.faculty,
    profile.age ? plural(t.age, profile.age) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  if (!editing) {
    return (
      <>
        <section className="profile-header">
          <span className="avatar avatar-large">
            {initialsFor(profile.display_name)}
          </span>
          <div>
            <h2>{profile.display_name}</h2>
            {details && <p>{details}</p>}
            {profile.academic_status_verified && (
              <span className="verified-badge">
                <VerifiedIcon size={16} />
                {t.verified}
              </span>
            )}
          </div>
          <button className="text-link" type="button" onClick={startEditing}>
            {t.edit}
          </button>
        </section>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        {saved && (
          <p className="success-message" role="status">
            {t.saved}
          </p>
        )}
      </>
    );
  }

  const fieldProps = (field: ProfileField) => ({
    name: field,
    value: draft[field],
    onChange: update(field),
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
    disabled: mutation.isPending,
  });

  const fieldError = (field: ProfileField) => {
    const error = errors[field];
    return (
      error && (
        <small className="field-error" id={`${field}-error`}>
          {format(t.validation[error], validationLimits[error])}
        </small>
      )
    );
  };

  return (
    <form className="profile-form" onSubmit={onSubmit} noValidate>
      <h2>{t.form.title}</h2>
      <label>
        {t.form.displayName}
        <input
          {...fieldProps("displayName")}
          autoComplete="name"
          maxLength={PROFILE_LIMITS.displayNameMax + 20}
        />
        {fieldError("displayName")}
      </label>
      <label>
        {t.form.faculty}
        <input
          {...fieldProps("faculty")}
          placeholder={t.form.facultyPlaceholder}
        />
        {fieldError("faculty")}
      </label>
      <label>
        {t.form.age}
        <input {...fieldProps("age")} inputMode="numeric" />
        {fieldError("age")}
      </label>
      <label>
        {t.form.bio}
        <textarea {...fieldProps("bio")} rows={4} />
        <small className="field-hint">
          {draft.bio.trim().length}/{PROFILE_LIMITS.bioMax}
        </small>
        {fieldError("bio")}
      </label>
      {mutation.isError && (
        <p className="error-message" role="alert">
          {t.errors[(mutation.error as ProfileRequestError).kind]}
        </p>
      )}
      <div className="profile-form-actions">
        <button
          className="button button-outline"
          type="button"
          onClick={() => setEditing(false)}
          disabled={mutation.isPending}
        >
          {t.form.cancel}
        </button>
        <button className="button" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t.form.saving : t.form.save}
        </button>
      </div>
    </form>
  );
}

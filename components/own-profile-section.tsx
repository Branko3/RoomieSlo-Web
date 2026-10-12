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
  type ProfileRequestError,
} from "../lib/profile/own-profile";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";

export const OWN_PROFILE_QUERY_KEY = ["profile", "own"] as const;

function PreviewHeader() {
  return (
    <section className="profile-header">
      <span className="avatar avatar-large">AH</span>
      <div>
        <h2>Amar H.</h2>
        <p>FRI, Univerza v Ljubljani · 22 let</p>
        <span className="verified-badge">✓ Preverjen študent</span>
      </div>
    </section>
  );
}

export function OwnProfileSection({ configured }: { configured: boolean }) {
  if (!configured) return <PreviewHeader />;
  return <ConnectedProfile />;
}

function ConnectedProfile() {
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
        <p role="status">Nalaganje profila …</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="profile-card" role="alert">
        <div>
          <b>Profila ni bilo mogoče naložiti</b>
          <p>{query.error.message}</p>
        </div>
        <button
          className="button button-outline"
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          Poskusi znova
        </button>
      </section>
    );
  }

  const result = query.data;
  if (result.status === "signed-out") {
    return (
      <section className="profile-card">
        <div>
          <b>Nisi prijavljen</b>
          <p>Prijavi se, da vidiš in urejaš svoj profil.</p>
        </div>
        <Link className="button" href="/login">
          Prijava
        </Link>
      </section>
    );
  }

  if (result.status === "missing") {
    return (
      <section className="profile-card" role="alert">
        <div>
          <b>Profil še ni pripravljen</b>
          <p>
            Tvoj račun še nima profila. Osveži stran čez nekaj trenutkov ali se
            obrni na podporo.
          </p>
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
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>(() =>
    draftFromProfile(profile),
  );
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>(
    {},
  );
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

  const details = [profile.faculty, profile.age ? `${profile.age} let` : ""]
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
              <span className="verified-badge">✓ Preverjen študent</span>
            )}
          </div>
          <button className="text-link" type="button" onClick={startEditing}>
            Uredi
          </button>
        </section>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        {saved && (
          <p className="success-message" role="status">
            Profil je shranjen.
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

  const fieldError = (field: ProfileField) =>
    errors[field] && (
      <small className="field-error" id={`${field}-error`}>
        {errors[field]}
      </small>
    );

  return (
    <form className="profile-form" onSubmit={onSubmit} noValidate>
      <h2>Uredi profil</h2>
      <label>
        Ime in priimek
        <input
          {...fieldProps("displayName")}
          autoComplete="name"
          maxLength={PROFILE_LIMITS.displayNameMax + 20}
        />
        {fieldError("displayName")}
      </label>
      <label>
        Fakulteta
        <input
          {...fieldProps("faculty")}
          placeholder="FRI, Univerza v Ljubljani"
        />
        {fieldError("faculty")}
      </label>
      <label>
        Starost
        <input {...fieldProps("age")} inputMode="numeric" />
        {fieldError("age")}
      </label>
      <label>
        O meni
        <textarea {...fieldProps("bio")} rows={4} />
        <small className="field-hint">
          {draft.bio.trim().length}/{PROFILE_LIMITS.bioMax}
        </small>
        {fieldError("bio")}
      </label>
      {mutation.isError && (
        <p className="error-message" role="alert">
          {(mutation.error as ProfileRequestError).message}
        </p>
      )}
      <div className="profile-form-actions">
        <button
          className="button button-outline"
          type="button"
          onClick={() => setEditing(false)}
          disabled={mutation.isPending}
        >
          Prekliči
        </button>
        <button className="button" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Shranjevanje …" : "Shrani"}
        </button>
      </div>
    </form>
  );
}

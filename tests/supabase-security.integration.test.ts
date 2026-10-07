import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const env = process.env;
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "RLS_USER_A_EMAIL",
  "RLS_USER_A_PASSWORD",
  "RLS_USER_B_EMAIL",
  "RLS_USER_B_PASSWORD",
  "RLS_UNRELATED_EMAIL",
  "RLS_UNRELATED_PASSWORD",
  "RLS_USER_A_ID",
  "RLS_USER_B_ID",
  "RLS_UNRELATED_ID",
  "RLS_ADMIN_EMAIL",
  "RLS_ADMIN_PASSWORD",
  "RLS_LISTING_ID",
  "RLS_MATCH_ID",
  "RLS_MESSAGE_ID",
  "RLS_REPORT_ID",
  "RLS_DOCUMENT_PATH",
];
const configured = required.every((name) => Boolean(env[name]));

function client() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedIn(email: string, password: string) {
  const supabase = client();
  const result = await supabase.auth.signInWithPassword({ email, password });
  expect(result.error, `sign-in failed for ${email}`).toBeNull();
  return supabase;
}

async function expectDenied(
  operation: PromiseLike<{ error: { message: string } | null; data: unknown }>,
) {
  const result = await operation;
  expect(result.error, "operation unexpectedly succeeded").not.toBeNull();
}

async function expectNoRows(
  operation: PromiseLike<{ error: { message: string } | null; data: unknown[] | null }>,
) {
  const result = await operation;
  expect(result.error).toBeNull();
  expect(result.data ?? []).toHaveLength(0);
}

describe.skipIf(!configured)("disposable Supabase RLS and Storage checks", () => {
  it("denies unauthenticated protected reads and mutations", async () => {
    const supabase = client();
    await expectNoRows(supabase.from("profiles").select("id").eq("id", env.RLS_USER_A_ID!));
    await expectNoRows(supabase.from("listings").select("id").eq("id", env.RLS_LISTING_ID!));
    await expectNoRows(supabase.from("matches").select("id").eq("id", env.RLS_MATCH_ID!));
    await expectNoRows(supabase.from("messages").select("id").eq("id", env.RLS_MESSAGE_ID!));
    await expectNoRows(supabase.from("reports").select("id").eq("id", env.RLS_REPORT_ID!));
    await expectDenied(
      supabase.from("listings").update({ description: "unauthenticated" }).eq("id", env.RLS_LISTING_ID!),
    );
    const document = await supabase.storage.from("vpisnice").download(env.RLS_DOCUMENT_PATH!);
    expect(document.error).not.toBeNull();
  });

  it("denies user B from user A profile, questionnaire, and listing mutations", async () => {
    const supabase = await signedIn(env.RLS_USER_B_EMAIL!, env.RLS_USER_B_PASSWORD!);
    await expectDenied(
      supabase.from("profiles").update({ display_name: "cross-owner" }).eq("id", env.RLS_USER_A_ID!),
    );
    await expectDenied(
      supabase
        .from("questionnaire_answers")
        .update({ value: 0 })
        .eq("profile_id", env.RLS_USER_A_ID!),
    );
    await expectDenied(
      supabase.from("listings").update({ description: "cross-owner" }).eq("id", env.RLS_LISTING_ID!),
    );
    await expectDenied(supabase.from("listings").delete().eq("id", env.RLS_LISTING_ID!));
  });

  it("denies an unrelated user from matches, messages, and administrative reports", async () => {
    const supabase = await signedIn(env.RLS_UNRELATED_EMAIL!, env.RLS_UNRELATED_PASSWORD!);
    await expectNoRows(supabase.from("matches").select("id").eq("id", env.RLS_MATCH_ID!));
    await expectNoRows(supabase.from("messages").select("id").eq("id", env.RLS_MESSAGE_ID!));
    await expectDenied(
      supabase.from("messages").insert({
        match_id: env.RLS_MATCH_ID,
        sender_id: env.RLS_UNRELATED_ID,
        body: "unauthorized",
      }),
    );
    await expectNoRows(supabase.from("reports").select("id").eq("id", env.RLS_REPORT_ID!));
    await expectDenied(
      supabase.from("reports").update({ status: "reviewed" }).eq("id", env.RLS_REPORT_ID!),
    );
    const document = await supabase.storage.from("vpisnice").download(env.RLS_DOCUMENT_PATH!);
    expect(document.error).not.toBeNull();
  });

  it("allows participants and administrators only on their permitted surfaces", async () => {
    const participant = await signedIn(env.RLS_USER_A_EMAIL!, env.RLS_USER_A_PASSWORD!);
    const match = await participant.from("matches").select("id").eq("id", env.RLS_MATCH_ID!);
    expect(match.error).toBeNull();
    expect(match.data).toHaveLength(1);
    const messages = await participant.from("messages").select("id").eq("match_id", env.RLS_MATCH_ID!);
    expect(messages.error).toBeNull();
    const ownerDocument = await participant.storage
      .from("vpisnice")
      .download(env.RLS_DOCUMENT_PATH!);
    expect(ownerDocument.error).toBeNull();

    const admin = await signedIn(env.RLS_ADMIN_EMAIL!, env.RLS_ADMIN_PASSWORD!);
    const report = await admin.from("reports").select("id").eq("id", env.RLS_REPORT_ID!);
    expect(report.error).toBeNull();
    expect(report.data).toHaveLength(1);
    const document = await admin.storage.from("vpisnice").download(env.RLS_DOCUMENT_PATH!);
    expect(document.error).toBeNull();
  });

  it("rejects a public academic-document URL", async () => {
    const supabase = client();
    const publicUrl = supabase.storage.from("vpisnice").getPublicUrl(env.RLS_DOCUMENT_PATH!).data.publicUrl;
    const response = await fetch(publicUrl);
    expect(response.ok).toBe(false);
  });
});

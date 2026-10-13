// Self-service account deletion (deletion plan step 4).
// The caller is identified only from their access token; a user id in the
// request is never accepted. Order matters: documents first (SQL can't remove
// Storage files), then the Auth user, whose deletion trigger
// (`handle_deleted_user`) applies the retention matrix and leaves a tombstone.
// Re-running after a partial failure is safe: an empty folder is skipped and a
// deleted user gets 410.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  DOCUMENT_BUCKET,
  documentFolder,
  documentPaths,
  isConfirmationValid,
  isMissingUserError,
  isRecentSignIn,
  logLine,
  statusFor,
  type DeletionOutcome,
} from "../_shared/account-deletion.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(outcome: DeletionOutcome, requestId: string): Response {
  return new Response(JSON.stringify({ outcome, request_id: requestId }), {
    status: statusFor(outcome),
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const requestId = crypto.randomUUID();
  if (request.method !== "POST")
    return respond("method_not_allowed", requestId);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const finish = async (
    outcome: DeletionOutcome,
    userId?: string,
    detail?: string,
  ) => {
    console.log(logLine(outcome, requestId, detail));
    if (userId && (outcome === "deleted" || outcome === "partial_failure")) {
      // The register keeps the subject only to re-apply deletions after a backup
      // restore; the retention job clears it after 30 days.
      await admin.from("deletion_register").insert({
        id: requestId,
        subject: userId,
        outcome,
        completed_at: outcome === "deleted" ? new Date().toISOString() : null,
      });
    }
    return respond(outcome, requestId);
  };

  // 1. Who is asking: only the verified token decides.
  const token = (request.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token) return finish("session_expired");
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return finish(
      isMissingUserError(userError) ? "already_deleted" : "session_expired",
    );
  }
  const user = userData.user;

  // 2. Explicit confirmation.
  let body: { confirm?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // An empty or malformed body is simply not a confirmation.
  }
  if (!isConfirmationValid(body.confirm)) return finish("invalid_confirmation");

  // 3. Recent password sign-in (the web signs in again just before calling).
  if (!isRecentSignIn(user.last_sign_in_at, Date.now())) {
    return finish("reauth_required");
  }

  // 4. Academic documents: list, remove, and verify the folder is empty.
  const storage = admin.storage.from(DOCUMENT_BUCKET);
  const folder = documentFolder(user.id);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data: objects, error: listError } = await storage.list(folder, {
      limit: 100,
    });
    if (listError) return finish("partial_failure", user.id, "storage_list");
    const paths = documentPaths(
      user.id,
      (objects ?? []).map((object) => object.name),
    );
    if (paths.length === 0) break;
    const { error: removeError } = await storage.remove(paths);
    if (removeError)
      return finish("partial_failure", user.id, "storage_remove");
  }
  const { data: left, error: verifyError } = await storage.list(folder, {
    limit: 1,
  });
  if (verifyError || (left ?? []).length > 0) {
    return finish("partial_failure", user.id, "storage_verify");
  }

  // 5. The Auth user; the database trigger does the rest in one transaction.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return isMissingUserError(deleteError)
      ? finish("already_deleted")
      : finish("partial_failure", user.id, "auth_delete");
  }
  return finish("deleted", user.id);
});

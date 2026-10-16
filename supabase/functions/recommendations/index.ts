// Compatibility-ranked recommendations, computed on the server so questionnaire
// answers never leave the database: `questionnaire_answers` is readable only by
// its owner (migration 20261015000000). The caller is identified from the token;
// the response holds profiles, scores and shared-statement counts, never another
// person's answers. Each recommendation also carries the person's roommate
// rating summary from `rating_summaries` (aggregates only, migration
// 20261016000100); if that lookup fails, `ratings` is null and the list still loads.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  scoreCandidates,
  type CompatibilityAnswer,
} from "../_shared/compatibility.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROFILE_COLUMNS =
  "id,display_name,academic_status_verified,is_available,age,faculty,bio,questionnaire_answers(question_id,value,weight)";

type CandidateRow = {
  id: string;
  display_name: string | null;
  academic_status_verified: boolean;
  is_available: boolean;
  age: number | null;
  faculty: string | null;
  bio: string | null;
  questionnaire_answers: CompatibilityAnswer[] | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const token = (request.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  const { data: userData, error: userError } = token
    ? await admin.auth.getUser(token)
    : { data: { user: null }, error: null };
  const user = userData.user;
  if (userError || !user) return json({ error: "signed_out" }, 401);

  const [mine, candidates] = await Promise.all([
    admin
      .from("questionnaire_answers")
      .select("question_id,value,weight")
      .eq("profile_id", user.id),
    admin
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("is_available", true)
      .neq("id", user.id),
  ]);
  if (mine.error || candidates.error) {
    console.log(JSON.stringify({ event: "recommendations", outcome: "error" }));
    return json({ error: "failed" }, 500);
  }

  const myAnswers = (mine.data ?? []) as CompatibilityAnswer[];
  const ranked = scoreCandidates(
    myAnswers,
    ((candidates.data ?? []) as CandidateRow[]).map((row) => ({
      id: row.id,
      displayName: row.display_name?.trim() || "Uporabnik",
      verified: row.academic_status_verified === true,
      available: row.is_available === true,
      age: row.age,
      faculty: row.faculty ?? "",
      bio: row.bio ?? "",
      answers: row.questionnaire_answers ?? [],
    })),
  );
  const summaries = new Map<string, unknown>();
  if (ranked.length) {
    const { data, error } = await admin.rpc("rating_summaries", {
      p_profile_ids: ranked.map((r) => r.profile.id),
    });
    if (error) {
      console.log(
        JSON.stringify({ event: "recommendations", outcome: "ratings_error" }),
      );
    } else {
      for (const row of (data ?? []) as Array<{
        profile_id: string;
        summary: unknown;
      }>)
        summaries.set(row.profile_id, row.summary);
    }
  }
  return json({
    myAnswers,
    recommendations: ranked.map((r) => ({
      ...r,
      ratings: summaries.get(r.profile.id) ?? null,
    })),
  });
});

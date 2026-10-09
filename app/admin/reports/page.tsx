"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { useAuth } from "../../../components/auth-provider";

export default function AdminReportsPage() {
  const { session } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!session) return;
    const client = createSupabaseBrowserClient();
    client
      .from("admins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (queryError) setError(queryError.message);
        else setAllowed(Boolean(data));
      });
  }, [session]);
  if (error)
    return (
      <div className="page-state" role="alert">
        <h1>Poročil ni mogoče naložiti</h1>
        <p>{error}</p>
      </div>
    );
  if (allowed === null)
    return (
      <div className="page-state" aria-live="polite">
        <p>Preverjanje dovoljenj ...</p>
      </div>
    );
  if (!allowed)
    return (
      <div className="page-state" role="alert">
        <h1>Dostop zavrnjen</h1>
        <p>Za ogled poročil nimaš administratorskih dovoljenj.</p>
      </div>
    );
  return (
    <div className="content-wrap">
      <h1>Prijave uporabnikov</h1>
      <p>Administratorski pregled bo na voljo v naslednji fazi.</p>
    </div>
  );
}

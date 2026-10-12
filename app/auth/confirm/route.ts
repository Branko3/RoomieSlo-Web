import { NextResponse, type NextRequest } from "next/server";

import {
  completeConfirmation,
  parseConfirmationParams,
} from "../../../lib/auth/confirmation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const confirmation = parseConfirmationParams(request.nextUrl.searchParams);
  const destination = await completeConfirmation(
    confirmation,
    confirmation.kind === "error" ? null : createSupabaseServerClient(),
  );
  return NextResponse.redirect(new URL(destination, request.nextUrl.origin));
}

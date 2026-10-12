import { NextResponse } from "next/server";
import { httpStatus, liveness, readiness } from "../../../lib/ops/health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const report = deep
    ? await readiness(process.env, fetch)
    : liveness(process.env);
  return NextResponse.json(report, {
    status: httpStatus(report),
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

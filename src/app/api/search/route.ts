import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";
import { search } from "@/modules/search";

// Global search endpoint (C-16). The search box in the top bar calls this on
// each (debounced) keystroke. Authorization and owner-scoping live in the search
// service; here we only resolve the current user and pass the raw query through.
// Session state is read per request, so the route must never be statically
// cached.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await search(user, q);
  return NextResponse.json(results);
}

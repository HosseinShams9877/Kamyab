import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/modules/auth";

// Logout clears the session cookie. Because sessions are stateless, this only
// ends the session on this client; other concurrent sessions remain valid
// (owner ruling #8).
export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}

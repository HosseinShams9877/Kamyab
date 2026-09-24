import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth";

// Demo/introspection route: returns the current user together with their
// effective permission map. Any authenticated active user may call it; it exists
// so the client (and tests) can see exactly what the server has authorized.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
    },
  });
}

import { NextResponse } from "next/server";
import { loginSchema } from "@/schemas/auth";
import { authenticate } from "@/services/auth.service";
import { roleRedirect } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { toPersianDigits } from "@/lib/digits";

// Thin login handler: parse → validate → call the auth service → set the session
// cookie → return the role-based redirect target. All domain logic lives in the
// service; this handler only shapes requests and responses.

// Generic credential message (C-1): the same text for a wrong mobile OR a wrong
// password, so an attacker cannot tell which mobiles are registered.
const GENERIC_INVALID = "شماره موبایل یا رمز عبور نادرست است.";

function lockoutMessage(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
  return `به دلیل تلاش‌های ناموفق زیاد، ورود موقتاً قفل شده است. لطفاً ${toPersianDigits(
    minutes,
  )} دقیقه دیگر دوباره تلاش کنید.`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: GENERIC_INVALID }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    // Format errors (not a credential leak): surface the field messages so the
    // form can show them. Field presence/shape only — never account existence.
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { ok: false, message: GENERIC_INVALID, fieldErrors },
      { status: 400 },
    );
  }

  const result = await authenticate(parsed.data.mobile, parsed.data.password);

  if (!result.ok) {
    if (result.reason === "locked") {
      return NextResponse.json(
        { ok: false, message: lockoutMessage(result.retryAfterMs) },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { ok: false, message: GENERIC_INVALID },
      { status: 401 },
    );
  }

  await setSessionCookie(result.user.id);
  return NextResponse.json({ ok: true, redirect: roleRedirect(result.user.role) });
}

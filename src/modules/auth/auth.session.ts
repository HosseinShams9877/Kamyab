import crypto from "node:crypto";

// Server-verifiable session tokens. A session is a signed, self-describing token
// stored in an httpOnly cookie:
//
//   base64url(payloadJSON) + "." + base64url(HMAC-SHA256(payloadJSON))
//
// The signature is verified with SESSION_SECRET, and the payload's `exp` bounds
// the 12-hour lifetime. Because the token is stateless, multiple concurrent
// sessions coexist and a new login does NOT invalidate older ones (owner ruling
// #8). Whether the *user* is still allowed in (active status, current role) is
// re-checked against the database on every request — see lib/auth.ts. That DB
// re-check is what rejects a user deactivated mid-session.

export const SESSION_COOKIE = "kamyab_session";
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

type SessionPayload = {
  sub: string; // Employee id
  iat: number; // issued-at (epoch ms)
  exp: number; // expiry (epoch ms)
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set a long random value in .env.",
    );
  }
  return secret;
}

function base64urlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/** Create a signed session token for an employee id. */
export function signSession(userId: string, now: number = Date.now()): string {
  const payload: SessionPayload = {
    sub: userId,
    iat: now,
    exp: now + SESSION_DURATION_MS,
  };
  const encoded = base64urlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Verify a token's signature and expiry. Returns the employee id on success, or
 * null for any tampering, malformed token, or expired session.
 */
export function verifySession(
  token: string | undefined | null,
  now: number = Date.now(),
): { userId: string } | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const encoded = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = sign(encoded);

  // Constant-time comparison to avoid signature timing leaks.
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
    return null;
  }
  if (now >= payload.exp) return null;

  return { userId: payload.sub };
}

// --- Cookie helpers (server-only). next/headers is imported dynamically so this
// module's pure token functions above stay unit-testable in a plain Node env. ---

export async function setSessionCookie(userId: string): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSessionCookie(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

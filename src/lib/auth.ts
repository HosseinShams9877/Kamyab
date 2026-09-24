import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { readSessionCookie, verifySession } from "@/lib/session";
import type { Role } from "@/types/enums";

// Server-side session resolution and role routing. This is the enforcement point
// for "an inactive user's next request is rejected" (C-1): the session cookie
// only proves *which* employee is claimed; whether they may still act is decided
// here by re-reading their current status and role from the database on every
// call. A user deactivated mid-session fails this check on their very next
// request even though their cookie is still cryptographically valid.

export type CurrentUser = {
  id: string;
  fullName: string;
  role: Role;
};

/**
 * Resolve the currently authenticated, still-active employee, or null.
 * Returns null when there is no cookie, the signature/expiry is invalid, the
 * employee no longer exists, or the employee has been deactivated.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await readSessionCookie();
  const session = verifySession(token);
  if (!session) return null;

  const employee = await prisma.employee.findUnique({
    where: { id: session.userId },
    select: { id: true, fullName: true, role: true, status: true },
  });

  // Inactive-user rejection (including mid-session): a deactivated account is
  // treated exactly like no session at all.
  if (!employee || !employee.status) return null;

  return {
    id: employee.id,
    fullName: employee.fullName,
    role: employee.role as Role,
  };
}

/**
 * Require an authenticated active user in a server component; redirect to the
 * login page otherwise. Route handlers should instead branch on getCurrentUser
 * and return a 401 JSON response.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/** Where a role lands after login (C-1). */
export function roleRedirect(role: Role): string {
  // Manager and supervisor share the management dashboard; the employee gets
  // their own panel. The real pages are built in later phases; these paths are
  // the stable landing targets.
  return role === "EMPLOYEE" ? "/employee" : "/dashboard";
}

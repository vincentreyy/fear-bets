import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, roles } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { PERMS, ALL_PERMS, PERM_LABEL } from "@/lib/store";

export { PERMS, ALL_PERMS, PERM_LABEL };

export class AuthError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(perm) {
    super(`Missing permission: ${perm}`);
    this.name = "ForbiddenError";
    this.perm = perm;
  }
}

// Returns the signed-in user, or null if nobody's logged in (or their
// session no longer maps to a real user). When suspended, still returns
// them — callers that need "active" specifically should check status
// themselves. Role is always freshly loaded from the DB, never cached in
// the session cookie, so a de-admin'd user is denied on their very next
// call rather than after cookie expiry.
export const getOptionalUser = cache(async function getOptionalUser() {
  const session = await getSession();
  if (!session.userId) return null;
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, session.userId));
  if (!row) return null;
  return { ...row.user, role: row.role };
});

// Same as getOptionalUser(), but throws AuthError instead of returning null.
export async function requireUser() {
  const user = await getOptionalUser();
  if (!user) throw new AuthError();
  return user;
}

// Throws ForbiddenError if the signed-in user's role doesn't include `perm`.
// Never trust a role/permission value passed in from the client — this is
// the one place that decides who may do what.
export async function requirePermission(perm) {
  const user = await requireUser();
  if (!user.role || !user.role.perms.includes(perm)) {
    throw new ForbiddenError(perm);
  }
  return user;
}

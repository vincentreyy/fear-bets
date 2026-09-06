"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword, createSession, destroySession } from "@/lib/auth";
import { requireUser, getOptionalUser } from "@/lib/permissions";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function login(input) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a username and password." };
  const { username, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Incorrect username or password." };
  }
  if (user.status === "suspended") {
    return { ok: false, error: "This account is suspended. Contact an admin." };
  }

  await createSession(user.id);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  return { ok: true, mustChangePassword: user.mustChangePassword };
}

const changePasswordSchema = z.object({
  newPassword: z.string().min(8, "Use at least 8 characters."),
});

export async function changePassword(input) {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid password." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.update(users)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(users.id, user.id));

  return { ok: true };
}

export async function logout() {
  await destroySession();
  return { ok: true };
}

// Who's signed in, and what can they do — used by client components that
// need to refresh this after login/logout without a full page reload.
// Never returns the password hash.
export async function getSessionUser() {
  const user = await getOptionalUser();
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

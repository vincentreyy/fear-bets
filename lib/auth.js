import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

const BCRYPT_COST = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// A random temp password handed to a newly-created user (they're forced to
// replace it on first login via mustChangePassword).
export function generateTempPassword() {
  return "temp-" + Math.random().toString(36).slice(2, 10);
}

const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: "e1bets_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
};

// Session only ever stores the user id — role/permissions are looked up
// fresh from the database on every check (see lib/permissions.js) so a
// de-admin'd or suspended user is denied on their very next action instead
// of waiting for the cookie to expire.
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession(cookieStore, sessionOptions);
}

export async function createSession(userId) {
  const session = await getSession();
  session.userId = userId;
  await session.save();
}

export async function destroySession() {
  const session = await getSession();
  session.destroy();
}

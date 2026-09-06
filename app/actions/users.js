"use server";

import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { users, transactions } from "@/lib/db/schema";
import { hashPassword, generateTempPassword } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/audit";

const createUserSchema = z.object({
  displayName: z.string().trim().min(1),
  ign: z.string().trim().optional(),
  username: z.string().trim().min(1).regex(/^[a-z0-9_.]+$/i, "Letters, numbers, _ and . only."),
  roleId: z.string().optional().nullable(),
  initialBalance: z.number().int().min(0).default(0),
});

// Players can't sign themselves up — an admin creates the account and hands
// them the temporary password, which they're forced to replace on first
// login. No email is collected anywhere; login is username-based.
export async function createUser(input) {
  const admin = await requirePermission("manage_users");
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid user." };
  const p = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.username, p.username));
  if (existing) return { ok: false, error: "That username is taken." };

  const tempPassword = generateTempPassword();
  let userId;
  await db.transaction(async (tx) => {
    userId = createId();
    await tx.insert(users).values({
      id: userId,
      username: p.username,
      passwordHash: await hashPassword(tempPassword),
      displayName: p.displayName,
      ign: p.ign || null,
      roleId: p.roleId || null,
      confirmedBalance: p.initialBalance,
      mustChangePassword: true,
    });
    await logAction(tx, {
      adminId: admin.id,
      actionType: "User account created",
      targetType: "user",
      targetId: userId,
      note: `${p.displayName} · @${p.username}${p.roleId ? " · role assigned" : ""}${p.initialBalance ? ` · opening balance ${p.initialBalance} CR` : ""}`,
    });
  });

  return { ok: true, userId, tempPassword };
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().optional(),
});

export async function resetPassword(input) {
  const admin = await requirePermission("manage_users");
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing user id." };

  const tempPassword = generateTempPassword();
  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, parsed.data.userId));
    if (!user) throw new Error("User not found.");
    await tx.update(users).set({
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
    }).where(eq(users.id, user.id));
    await logAction(tx, {
      adminId: admin.id, actionType: "User password reset", targetType: "user",
      targetId: user.id, note: parsed.data.reason || "New temporary password issued",
    });
  });

  return { ok: true, tempPassword };
}

const toggleUserStatusSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().min(1, "A reason is required."),
});

export async function toggleUserStatus(input) {
  const admin = await requirePermission("manage_users");
  const parsed = toggleUserStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid request." };

  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, parsed.data.userId));
    if (!user) throw new Error("User not found.");
    const next = user.status === "active" ? "suspended" : "active";
    await tx.update(users).set({ status: next }).where(eq(users.id, user.id));
    await logAction(tx, {
      adminId: admin.id,
      actionType: next === "suspended" ? "User suspended" : "User reinstated",
      targetType: "user", targetId: user.id, note: parsed.data.reason,
    });
  });

  return { ok: true };
}

const adjustBalanceSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().refine(v => v !== 0, "Amount can't be zero."),
  reason: z.string().trim().min(1, "A reason is required."),
});

export async function adjustBalance(input) {
  const admin = await requirePermission("adjust_balances");
  const parsed = adjustBalanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid request." };
  const { userId, amount, reason } = parsed.data;

  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(users).where(eq(users.id, userId));
    if (!before) throw new Error("User not found.");
    const [after] = await tx.update(users)
      .set({ confirmedBalance: sql`GREATEST(${users.confirmedBalance} + ${amount}, 0)` })
      .where(eq(users.id, userId))
      .returning();
    await tx.insert(transactions).values({
      id: createId(), userId, type: "adjustment", amount, status: "applied", note: reason,
    });
    await logAction(tx, {
      adminId: admin.id, actionType: "Balance adjustment", targetType: "user", targetId: userId,
      before: { confirmedBalance: before.confirmedBalance },
      after: { confirmedBalance: after.confirmedBalance },
      note: reason,
    });
  });

  return { ok: true };
}

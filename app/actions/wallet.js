"use server";

import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { transactions, users, houseLedger } from "@/lib/db/schema";
import { requireUser, requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { money } from "@/lib/store";

const requestDepositSchema = z.object({
  amount: z.number().int().positive(),
});

// A regular user requests a top-up. Nothing is credited yet — it just enters
// the admin deposit queue as a pending Transaction.
export async function requestDeposit(input) {
  const user = await requireUser();
  const parsed = requestDepositSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid amount." };

  const [tx] = await db.insert(transactions).values({
    id: createId(),
    userId: user.id,
    type: "deposit",
    amount: parsed.data.amount,
    status: "pending",
    note: "Awaiting admin approval",
  }).returning();

  return { ok: true, transactionId: tx.id };
}

const idSchema = z.object({ transactionId: z.string().min(1) });

export async function approveDeposit(input) {
  const admin = await requirePermission("approve_deposits");
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing deposit id." };

  let balance;
  await db.transaction(async (tx) => {
    const [deposit] = await tx.select().from(transactions).where(eq(transactions.id, parsed.data.transactionId));
    if (!deposit || deposit.type !== "deposit" || deposit.status !== "pending") {
      throw new Error("This deposit is no longer pending.");
    }

    const [before] = await tx.select().from(users).where(eq(users.id, deposit.userId));
    const [after] = await tx.update(users)
      .set({ confirmedBalance: sql`${users.confirmedBalance} + ${deposit.amount}` })
      .where(eq(users.id, deposit.userId))
      .returning();
    await tx.update(transactions)
      .set({ status: "approved", adminId: admin.id, resolvedAt: new Date(), note: `Credited by ${admin.username}` })
      .where(eq(transactions.id, deposit.id));
    await tx.insert(houseLedger).values({
      id: createId(), type: "deposit", amount: deposit.amount,
      transactionId: deposit.id, adminId: admin.id,
      note: `Deposit approved · ${before.ign || before.displayName}`,
    });
    await logAction(tx, {
      adminId: admin.id,
      actionType: "Deposit approved",
      targetType: "user",
      targetId: deposit.userId,
      before: { confirmedBalance: before.confirmedBalance },
      after: { confirmedBalance: after.confirmedBalance },
      note: `${money(deposit.amount)} · Handoff confirmed in-game`,
    });
    balance = after.confirmedBalance;
  });

  return { ok: true, balance };
}

const rejectDepositSchema = z.object({
  transactionId: z.string().min(1),
  reason: z.string().trim().min(1, "A reason is required."),
});

export async function rejectDeposit(input) {
  const admin = await requirePermission("approve_deposits");
  const parsed = rejectDepositSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid request." };

  await db.transaction(async (tx) => {
    const [deposit] = await tx.select().from(transactions).where(eq(transactions.id, parsed.data.transactionId));
    if (!deposit || deposit.type !== "deposit" || deposit.status !== "pending") {
      throw new Error("This deposit is no longer pending.");
    }
    await tx.update(transactions)
      .set({ status: "rejected", adminId: admin.id, resolvedAt: new Date(), note: parsed.data.reason })
      .where(eq(transactions.id, deposit.id));
    await logAction(tx, {
      adminId: admin.id,
      actionType: "Deposit rejected",
      targetType: "user",
      targetId: deposit.userId,
      note: parsed.data.reason,
    });
  });

  return { ok: true };
}

// The three queue tabs in AdminQueues read from this one table, filtered by
// type/status, rather than three separate physical tables.
export async function listDepositQueue() {
  await requirePermission("approve_deposits");
  return db
    .select({ transaction: transactions, user: users })
    .from(transactions)
    .innerJoin(users, eq(transactions.userId, users.id))
    .where(and(eq(transactions.type, "deposit"), eq(transactions.status, "pending")))
    .orderBy(transactions.createdAt);
}

const requestWithdrawalSchema = z.object({
  amount: z.number().int().positive(),
  destination: z.string().trim().min(1, "Say where to hand it off."),
});

// The amount leaves the user's balance immediately and sits held until an
// admin approves or rejects the request — rejection returns it.
export async function requestWithdrawal(input) {
  const user = await requireUser();
  const parsed = requestWithdrawalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid request." };
  const { amount, destination } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      const [freshUser] = await tx.select().from(users).where(eq(users.id, user.id));
      if (freshUser.confirmedBalance < amount) throw new Error("Exceeds your balance.");

      await tx.update(users)
        .set({ confirmedBalance: sql`${users.confirmedBalance} - ${amount}` })
        .where(eq(users.id, user.id));
      await tx.insert(transactions).values({
        id: createId(), userId: user.id, type: "withdrawal", amount: -amount,
        status: "pending", destination, note: destination,
      });
    });
  } catch (e) {
    return { ok: false, error: e.message || "Could not submit withdrawal." };
  }

  return { ok: true };
}

export async function approveWithdrawal(input) {
  const admin = await requirePermission("approve_withdrawals");
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing withdrawal id." };

  await db.transaction(async (tx) => {
    const [wd] = await tx.select().from(transactions).where(eq(transactions.id, parsed.data.transactionId));
    if (!wd || wd.type !== "withdrawal" || wd.status !== "pending") {
      throw new Error("This withdrawal is no longer pending.");
    }
    await tx.update(transactions)
      .set({ status: "approved", adminId: admin.id })
      .where(eq(transactions.id, wd.id));
    await logAction(tx, {
      adminId: admin.id, actionType: "Withdrawal approved", targetType: "user",
      targetId: wd.userId, note: `${money(Math.abs(wd.amount))} · Cleared for in-game handoff`,
    });
  });

  return { ok: true };
}

const markWithdrawalPaidSchema = z.object({
  transactionId: z.string().min(1),
  note: z.string().trim().optional(),
});

export async function markWithdrawalPaid(input) {
  const admin = await requirePermission("approve_withdrawals");
  const parsed = markWithdrawalPaidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing withdrawal id." };

  await db.transaction(async (tx) => {
    const [wd] = await tx.select().from(transactions).where(eq(transactions.id, parsed.data.transactionId));
    if (!wd || wd.type !== "withdrawal" || wd.status !== "approved") {
      throw new Error("This withdrawal isn't approved yet.");
    }
    const [wdUser] = await tx.select().from(users).where(eq(users.id, wd.userId));
    await tx.update(transactions)
      .set({ status: "paid", resolvedAt: new Date(), note: parsed.data.note || wd.note })
      .where(eq(transactions.id, wd.id));
    await tx.insert(houseLedger).values({
      id: createId(), type: "withdrawal", amount: wd.amount,
      transactionId: wd.id, adminId: admin.id,
      note: `Withdrawal paid · ${wdUser.ign || wdUser.displayName}`,
    });
    await logAction(tx, {
      adminId: admin.id, actionType: "Withdrawal paid", targetType: "user",
      targetId: wd.userId, note: `${money(Math.abs(wd.amount))} · ${parsed.data.note || wd.destination}`,
    });
  });

  return { ok: true };
}

const rejectWithdrawalSchema = z.object({
  transactionId: z.string().min(1),
  reason: z.string().trim().min(1, "A reason is required."),
});

export async function rejectWithdrawal(input) {
  const admin = await requirePermission("approve_withdrawals");
  const parsed = rejectWithdrawalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid request." };

  await db.transaction(async (tx) => {
    const [wd] = await tx.select().from(transactions).where(eq(transactions.id, parsed.data.transactionId));
    if (!wd || wd.type !== "withdrawal" || wd.status !== "pending") {
      throw new Error("This withdrawal is no longer pending.");
    }
    await tx.update(users)
      .set({ confirmedBalance: sql`${users.confirmedBalance} + ${-wd.amount}` })
      .where(eq(users.id, wd.userId));
    await tx.update(transactions)
      .set({ status: "rejected", adminId: admin.id, resolvedAt: new Date(), note: parsed.data.reason })
      .where(eq(transactions.id, wd.id));
    await logAction(tx, {
      adminId: admin.id, actionType: "Withdrawal rejected", targetType: "user",
      targetId: wd.userId, note: parsed.data.reason,
    });
  });

  return { ok: true };
}

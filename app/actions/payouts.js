"use server";

import { z } from "zod";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, users } from "@/lib/db/schema";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/audit";

// The three admin queue tabs all live in `transactions`; payouts are just
// rows with type="win". Every action here takes one or more transaction
// ids so an admin can clear a whole race's winners in one click.
const idsSchema = z.object({ transactionIds: z.array(z.string().min(1)).min(1) });

export async function approvePayout(input) {
  const admin = await requirePermission("approve_payouts");
  const parsed = idsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing payout id(s)." };

  await db.transaction(async (tx) => {
    const rows = await tx.select().from(transactions)
      .where(and(inArray(transactions.id, parsed.data.transactionIds), eq(transactions.type, "win"), eq(transactions.status, "pending")));
    if (!rows.length) throw new Error("Nothing pending to approve.");

    await tx.update(transactions)
      .set({ status: "approved", adminId: admin.id })
      .where(inArray(transactions.id, rows.map(r => r.id)));

    const sum = rows.reduce((s, r) => s + r.amount, 0);
    await logAction(tx, {
      adminId: admin.id,
      actionType: rows.length > 1 ? "Payouts approved" : "Payout approved",
      targetType: "transaction",
      note: `${rows.length} payout${rows.length === 1 ? "" : "s"} · ${sum} CR`,
    });
  });

  return { ok: true };
}

export async function payPayout(input) {
  const admin = await requirePermission("approve_payouts");
  const parsed = idsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing payout id(s)." };

  await db.transaction(async (tx) => {
    const rows = await tx.select().from(transactions)
      .where(and(inArray(transactions.id, parsed.data.transactionIds), eq(transactions.type, "win"), eq(transactions.status, "approved")));
    if (!rows.length) throw new Error("Nothing approved to pay.");

    for (const r of rows) {
      await tx.update(users)
        .set({ confirmedBalance: sql`${users.confirmedBalance} + ${r.amount}` })
        .where(eq(users.id, r.userId));
      await tx.update(transactions)
        .set({ status: "paid", resolvedAt: new Date(), note: (r.note || "").replace(" · awaiting admin release", "") })
        .where(eq(transactions.id, r.id));
    }

    const sum = rows.reduce((s, r) => s + r.amount, 0);
    await logAction(tx, {
      adminId: admin.id,
      actionType: rows.length > 1 ? "Payouts marked paid" : "Payout marked paid",
      targetType: "transaction",
      note: `${rows.length} winner${rows.length === 1 ? "" : "s"} · ${sum} CR`,
    });
  });

  return { ok: true };
}

const holdPayoutSchema = z.object({
  transactionId: z.string().min(1),
  reason: z.string().trim().min(1, "A reason is required."),
});

export async function holdPayout(input) {
  const admin = await requirePermission("approve_payouts");
  const parsed = holdPayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid request." };

  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(transactions).where(eq(transactions.id, parsed.data.transactionId));
    if (!row || row.type !== "win") throw new Error("Payout not found.");
    await tx.update(transactions).set({ status: "held" }).where(eq(transactions.id, row.id));
    await logAction(tx, {
      adminId: admin.id, actionType: "Payout held", targetType: "user",
      targetId: row.userId, note: parsed.data.reason,
    });
  });

  return { ok: true };
}

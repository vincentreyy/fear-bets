"use server";

import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { houseLedger } from "@/lib/db/schema";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { money } from "@/lib/store";

const logHouseTransactionSchema = z.object({
  amount: z.number().int().refine(n => n !== 0, "Enter a non-zero amount."),
  note: z.string().trim().min(1, "A reason is required."),
});

// Manual entries into the shared house wallet ledger — everything else in
// house_ledger (rake, deposits, withdrawals) is auto-recorded at its own
// source of truth (see app/actions/settlement.js and app/actions/wallet.js).
// amount is signed: positive credits the house wallet, negative debits it.
export async function logHouseTransaction(input) {
  const admin = await requirePermission("manage_finance");
  const parsed = logHouseTransactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid entry." };
  const { amount, note } = parsed.data;

  await db.transaction(async (tx) => {
    await tx.insert(houseLedger).values({
      id: createId(), type: amount > 0 ? "manual_in" : "manual_out", amount, note, adminId: admin.id,
    });
    await logAction(tx, {
      adminId: admin.id,
      actionType: amount > 0 ? "House funds added" : "House funds withdrawn",
      targetType: "house_ledger",
      note: `${money(Math.abs(amount))} · ${note}`,
    });
  });

  return { ok: true };
}

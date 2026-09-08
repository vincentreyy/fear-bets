import { db } from "@/lib/db";
import { houseLedger, users } from "@/lib/db/schema";

// The house wallet ledger, plus rolled-up totals. `balance` is real cash
// currently held — deposits minus withdrawals plus manual/correction
// entries. Rake is deliberately excluded from it: rake doesn't move any
// new cash into the house wallet, it's just an accounting split of cash
// that was already counted when the underlying deposit came in (the
// portion of a losing pool that stays with the house instead of paying
// out to winners), so including it too would double-count.
//
// `credits` is a different cut: how much of the balance is actually the
// house's own earned/lost money, as opposed to custodial player funds —
// rake plus net entries from the "Log a transaction" feature specifically
// (manual_in/manual_out). It deliberately excludes correction_in/out,
// which adjustBalance always writes alongside a balance adjustment (see
// app/actions/users.js) — those track a player-balance fix, not the
// house's own earnings, even though they may also move real cash.
export async function getHouseFinance() {
  const rows = await db.select().from(houseLedger).orderBy(houseLedger.createdAt);
  const userRows = await db.select().from(users);
  const usersById = Object.fromEntries(userRows.map(u => [u.id, u]));

  const sumOf = type => rows.filter(r => r.type === type).reduce((s, r) => s + r.amount, 0);

  return {
    balance: rows.filter(r => r.type !== "rake").reduce((s, r) => s + r.amount, 0),
    credits: sumOf("rake") + sumOf("manual_in") + sumOf("manual_out"),
    totalRake: sumOf("rake"),
    totalDeposits: sumOf("deposit"),
    totalWithdrawals: sumOf("withdrawal"),
    ledger: rows.reverse().map(r => ({
      id: r.id, type: r.type, amount: r.amount, note: r.note || "",
      admin: usersById[r.adminId]?.displayName || usersById[r.adminId]?.username || r.adminId,
      at: r.createdAt.getTime(),
    })),
  };
}

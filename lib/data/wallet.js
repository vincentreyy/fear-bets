import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, transactions } from "@/lib/db/schema";

// A user's own confirmed balance plus their own transaction history,
// mapped like the old getInitialData's `myTx`. One leftJoin instead of two
// separate selects — with zero transactions this still returns exactly one
// row (the user side populated, the transactions side null).
export async function getMyBalanceAndTx(userId) {
  const rows = await db.select({ balance: users.confirmedBalance, tx: transactions })
    .from(users)
    .leftJoin(transactions, eq(transactions.userId, users.id))
    .where(eq(users.id, userId));

  const balance = rows[0]?.balance || 0;
  const tx = rows.filter(r => r.tx?.id).map(r => ({
    id: r.tx.id, uid: "me", type: r.tx.type, amount: r.tx.amount, status: r.tx.status,
    at: r.tx.createdAt.getTime(), note: r.tx.note || "",
  }));
  return { balance, tx };
}

// This user's own pending winnings/withdrawal totals (mirrors
// myPendingWin/myPendingWd in lib/store.js, which match on
// `w.user === "You"` against S.winQueue/S.wdQueue) plus the raw list of
// this user's own pending withdrawal transactions, since Wallet renders an
// "IN THE QUEUE" list, not just a total. This is always user-scoped — never
// confuse with the global admin queues in lib/data/adminQueues.js. One
// broader query (both types) instead of two separately-filtered ones.
export async function getMyPendingWinWd(userId) {
  const rows = await db.select().from(transactions).where(
    and(eq(transactions.userId, userId), inArray(transactions.type, ["win", "withdrawal"]))
  );

  const winRows = rows.filter(t => t.type === "win" && ["pending", "approved"].includes(t.status));
  const pendingWin = winRows.reduce((s, t) => s + t.amount, 0);

  const wdRows = rows.filter(t => t.type === "withdrawal" && !["paid", "rejected"].includes(t.status));
  const pendingWd = wdRows.reduce((s, t) => s + Math.abs(t.amount), 0);
  const myWithdrawals = wdRows.map(t => ({
    id: t.id, user: "You", amount: Math.abs(t.amount), dest: t.destination || "",
    at: t.createdAt.getTime(), status: t.status,
  }));

  return { pendingWin, pendingWd, myWithdrawals };
}

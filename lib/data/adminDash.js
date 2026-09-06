import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, bets, transactions, adminActionLog } from "@/lib/db/schema";
import { labelFor, _loadAuditLookupMaps } from "@/lib/data/audit";

// Total in-game currency in circulation: every confirmed balance plus
// whatever's currently locked in pending bets. Matches the old
// getInitialData's `circulationTotal`.
export async function getCirculationTotal() {
  const userRows = await db.select().from(users);
  const betRows = await db.select().from(bets);
  return userRows.reduce((s, u) => s + u.confirmedBalance, 0)
    + betRows.filter(b => b.status === "pending").reduce((s, b) => s + b.stake, 0);
}

// All-time paid withdrawals total + count, matching the old
// getInitialData's `withdrawnAllTime`.
export async function getWithdrawnAllTime() {
  const paidWithdrawals = await db.select().from(transactions).where(and(eq(transactions.type, "withdrawal"), eq(transactions.status, "paid")));
  return {
    total: paidWithdrawals.reduce((s, t) => s + Math.abs(t.amount), 0),
    count: paidWithdrawals.length,
  };
}

// Most recent N audit-log entries, for a compact dashboard card. Same
// labeling logic as lib/data/audit.js's getAuditLog, just capped and
// queried newest-first directly rather than fetching the whole log.
export async function getAuditLogRecent(limit = 10) {
  const rows = await db.select().from(adminActionLog).orderBy(desc(adminActionLog.createdAt)).limit(limit);
  const maps = await _loadAuditLookupMaps();
  return rows.map(a => ({
    id: a.id, who: maps.usersById[a.adminId]?.username || a.adminId,
    act: a.actionType, target: labelFor(a.targetType, a.targetId, maps),
    at: a.createdAt.getTime(), note: a.note || "",
  }));
}

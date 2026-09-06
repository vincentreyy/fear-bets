import { db } from "@/lib/db";
import { roles, users } from "@/lib/db/schema";

// Matches the old getInitialData's `rolesList`.
export async function getRolesList() {
  const roleRows = await db.select().from(roles);
  return roleRows.map(r => ({ id: r.id, name: r.name, desc: r.desc || "", perms: r.perms, builtin: r.builtin, seeded: r.seeded }));
}

// Slim id+roleId pairs for every user — used by the Admin Roles page's
// "held by" count column, which only needs a per-role count, not the full
// getUsersList shape (balances/bets are unnecessary weight there).
export async function getUserRoleCounts() {
  const rows = await db.select({ id: users.id, roleId: users.roleId }).from(users);
  return rows;
}

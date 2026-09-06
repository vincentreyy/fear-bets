import { db } from "@/lib/db";
import { adminActionLog, users, races, roles, championships, drivers, teams } from "@/lib/db/schema";

// Copied from the old lib/data.js (was a local helper there) — resolves an
// audit-log target reference into a human-readable label using small
// lookup maps for each of the entity types an audit action can target.
export function labelFor(targetType, targetId, maps) {
  if (!targetId) return targetType;
  const byType = {
    user: maps.usersById, race: maps.racesById, role: maps.rolesById,
    championship: maps.championshipsById, driver: maps.driversById, team: maps.teamsById,
  };
  const row = byType[targetType]?.[targetId];
  const name = row?.displayName || row?.name || null;
  return name ? `${name}` : targetType;
}

async function loadLookupMaps() {
  const userRows = await db.select().from(users);
  const raceRows = await db.select().from(races);
  const roleRows = await db.select().from(roles);
  const championshipRows = await db.select().from(championships);
  const driverRows = await db.select().from(drivers);
  const teamRows = await db.select().from(teams);
  return {
    usersById: Object.fromEntries(userRows.map(u => [u.id, u])),
    racesById: Object.fromEntries(raceRows.map(r => [r.id, r])),
    rolesById: Object.fromEntries(roleRows.map(r => [r.id, r])),
    championshipsById: Object.fromEntries(championshipRows.map(c => [c.id, c])),
    driversById: Object.fromEntries(driverRows.map(d => [d.id, d])),
    teamsById: Object.fromEntries(teamRows.map(t => [t.id, t])),
  };
}

function mapAuditRows(rows, maps) {
  return rows.reverse().map(a => ({
    id: a.id, who: maps.usersById[a.adminId]?.username || a.adminId,
    act: a.actionType, target: labelFor(a.targetType, a.targetId, maps),
    at: a.createdAt.getTime(), note: a.note || "",
  }));
}

// Full audit log, mapped like the old getInitialData's `audit`.
export async function getAuditLog() {
  const rows = await db.select().from(adminActionLog).orderBy(adminActionLog.createdAt);
  const maps = await loadLookupMaps();
  return mapAuditRows(rows, maps);
}

export { loadLookupMaps as _loadAuditLookupMaps, mapAuditRows as _mapAuditRows };

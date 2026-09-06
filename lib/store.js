export const CUR = "CR";
export const fmt = (n, d = 0) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const money = (n, d = 0) => fmt(n, d) + " " + CUR;

// FIA points: P1–P10 plus a bonus point for fastest lap (top-10 finish required)
export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const FL_POINT = 1;
export const ptsFor = pos => POINTS[pos - 1] || 0;

export const poolOf = (bets, raceId) => bets.filter(b => b.raceId === raceId && b.status !== "void").reduce((s, b) => s + b.stake, 0);
export const driverPools = (bets, race) => {
  const total = poolOf(bets, race.id);
  return race.drivers.map(id => {
    const p = bets.filter(b => b.raceId === race.id && b.dId === id && b.status !== "void").reduce((s, b) => s + b.stake, 0);
    const net = total * (1 - race.rake / 100);
    return { id, pool: p, share: total ? p / total : 0, mult: p ? net / p : 0, backers: bets.filter(b => b.raceId === race.id && b.dId === id).length };
  });
};
export const countdown = ms => {
  if (ms <= 0) return "LOCKED";
  const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
  return (h > 0 ? h + "h " : "") + String(m).padStart(2, "0") + "m " + String(s).padStart(2, "0") + "s";
};
export const when = ts => new Date(ts).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
export const ago = ts => { const m = Math.round((Date.now() - ts) / 6e4); if (m < 60) return m + "m ago"; const h = Math.round(m / 60); return h < 48 ? h + "h ago" : Math.round(h / 24) + "d ago"; };
export const seasonWindow = races => races.filter(r => r.kind === "season");
export const raceWindow = races => races.filter(r => r.kind !== "season");
export const STATUS = { upcoming: ["Upcoming", "b-set"], open: ["Betting open", "b-open"], locked: ["Locked", "b-lock"], live: ["Live", "b-live"], finished: ["Finished", "b-lock"], held: ["Held — under review", "b-live"], settled: ["Settled", "b-set"] };

export const myPendingWin = S => S.winQueue.filter(w => w.user === "You" && (w.status === "pending" || w.status === "approved")).reduce((a, w) => a + w.amount, 0);
export const myPendingWd = S => S.wdQueue.filter(w => w.user === "You" && w.status !== "paid" && w.status !== "rejected").reduce((a, w) => a + w.amount, 0);
export const PERMS = [
  { key: "approve_deposits", label: "Approve deposits", group: "Money" },
  { key: "approve_payouts", label: "Approve payouts", group: "Money" },
  { key: "approve_withdrawals", label: "Approve withdrawals", group: "Money" },
  { key: "adjust_balances", label: "Adjust balances", group: "Money" },
  { key: "manage_races", label: "Manage & edit races", group: "Racing" },
  { key: "enter_results", label: "Enter results & settlement", group: "Racing" },
  { key: "resolve_disputes", label: "Rule on disputes", group: "Racing" },
  { key: "manage_championships", label: "Manage championships & roster", group: "Racing" },
  { key: "manage_users", label: "Manage users", group: "Administration" },
  { key: "manage_roles", label: "Manage roles", group: "Administration", sensitive: true },
  { key: "view_audit_log", label: "View audit log & reports", group: "Administration" }
];
export const ALL_PERMS = PERMS.map(p => p.key);
export const PERM_LABEL = k => (PERMS.find(p => p.key === k) || { label: k }).label;
export const CLS_LABEL = { dnf: "DNF", dns: "DNS", dsq: "DSQ" };
export const CLS_TEXT = { dnf: "Did not finish", dns: "Did not start", dsq: "Disqualified" };
// final classification for a driver in a settled race: {pos} | {st} | null
export const finishOf = (race, id) => {
  if (!race || race.status !== "settled") return null;
  const r = (race.retired || []).find(x => x.id === id);
  if (r) return { st: r.st };
  const i = (race.order || []).indexOf(id);
  return i > -1 ? { pos: i + 1 } : null;
};
export const classifyOrder = (race, ids) => {
  if (!race || race.status !== "settled" || !race.order) return null;
  const rank = id => { const f = finishOf(race, id); return f ? (f.pos || 100 + ["dnf", "dns", "dsq"].indexOf(f.st)) : 999; };
  return ids.slice().sort((a, b) => rank(a) - rank(b));
};
export const dtLocal = ts => { const d = new Date(ts); const p = n => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()); };
export const ORD = n => n + ([, "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || "th");

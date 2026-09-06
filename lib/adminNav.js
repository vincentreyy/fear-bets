// Plain data, no React/DOM/server imports — safely importable from both
// the server admin layout and any client component (e.g. AdminSidebar).
export const ADMIN_NAV = [
  { key: "dash", label: "Dashboard", href: "/admin", perms: null },
  { key: "queues", label: "Approval queues", href: "/admin/queues", perms: ["approve_deposits", "approve_payouts", "approve_withdrawals"] },
  { key: "settle", label: "Result & settlement", href: "/admin/settle", perms: ["enter_results", "resolve_disputes"] },
  { key: "races", label: "Race management", href: "/admin/races", perms: ["manage_races"] },
  { key: "champ", label: "Championships", href: "/admin/championships", perms: ["manage_championships"] },
  { key: "roster", label: "Roster", href: "/admin/roster", perms: ["manage_championships"] },
  { key: "users", label: "Users", href: "/admin/users", perms: ["manage_users"] },
  { key: "audit", label: "Audit log", href: "/admin/audit", perms: ["view_audit_log"] },
  { key: "roles", label: "Admin roles", href: "/admin/roles", perms: ["manage_roles"] },
];

export const canSeeAdminNav = (item, perms) => !item.perms || item.perms.some(p => perms.includes(p));

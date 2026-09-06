import { requireAnyPermissionOrRedirect } from "@/lib/pageGuards";
import { ALL_PERMS } from "@/lib/permissions";
import { ADMIN_NAV, canSeeAdminNav } from "@/lib/adminNav";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function AdminLayout({ children }) {
  // "some admin role at all" — the coarse gate. Each /admin/* page also
  // enforces its own specific permission on top of this (defense in depth).
  const user = await requireAnyPermissionOrRedirect(ALL_PERMS, { to: "/dashboard" });
  const visible = ADMIN_NAV.filter(item => canSeeAdminNav(item, user.role.perms));

  return <div className="wrap-wide flex" style={{ gap: 32, alignItems: "flex-start", paddingBottom: 80 }}>
    <AdminSidebar items={visible} />
    <div style={{ flex: 1, paddingTop: 24, minWidth: 0 }}>{children}</div>
  </div>;
}

import { requirePermissionOrRedirect } from "@/lib/pageGuards";
import { getAuditLog } from "@/lib/data/audit";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminAudit } from "@/components/AdminExtra";

export default async function AdminAuditPage() {
  await requirePermissionOrRedirect("view_audit_log");
  const audit = await getAuditLog();

  return (
    <ErrorBoundary>
      <AdminAudit S={{ audit }} />
    </ErrorBoundary>
  );
}

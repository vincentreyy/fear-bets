import { requirePermissionOrRedirect } from "@/lib/pageGuards";
import { getHouseFinance } from "@/lib/data/finance";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminFinance } from "@/components/AdminFinance";

export default async function AdminFinancePage() {
  await requirePermissionOrRedirect("manage_finance");
  const finance = await getHouseFinance();

  return (
    <ErrorBoundary>
      <AdminFinance S={finance} />
    </ErrorBoundary>
  );
}

import { requireAnyPermissionOrRedirect } from "@/lib/pageGuards";
import { getDepositQueue, getWinQueue, getWithdrawalQueue } from "@/lib/data/adminQueues";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminQueues } from "@/components/AdminScreens";

export default async function AdminQueuesPage() {
  const user = await requireAnyPermissionOrRedirect(["approve_deposits", "approve_payouts", "approve_withdrawals"]);
  const perms = user.role.perms;
  const has = p => perms.includes(p);

  const depQueue = has("approve_deposits") ? await getDepositQueue() : [];
  const winQueue = has("approve_payouts") ? await getWinQueue() : [];
  const wdQueue = has("approve_withdrawals") ? await getWithdrawalQueue() : [];

  return (
    <ErrorBoundary>
      <AdminQueues S={{ depQueue, winQueue, wdQueue }} />
    </ErrorBoundary>
  );
}

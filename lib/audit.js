import { createId } from "@paralleldrive/cuid2";
import { adminActionLog } from "@/lib/db/schema";

// Writes one AdminActionLog row. Always call this with the same `tx` (a
// Drizzle transaction object) used for the mutation it's describing, so the
// audit entry and the change it records commit or roll back together.
export async function logAction(tx, { adminId, actionType, targetType, targetId, before, after, note }) {
  await tx.insert(adminActionLog).values({
    id: createId(),
    adminId,
    actionType,
    targetType,
    targetId: targetId ?? null,
    beforeValue: before ?? null,
    afterValue: after ?? null,
    note: note ?? null,
  });
}

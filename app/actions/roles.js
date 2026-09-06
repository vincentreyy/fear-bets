"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { roles, users } from "@/lib/db/schema";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { ALL_PERMS, PERM_LABEL } from "@/lib/store";

const roleSchema = z.object({
  name: z.string().trim().min(1),
  desc: z.string().trim().optional(),
  perms: z.array(z.enum(ALL_PERMS)).min(1, "Check at least one permission."),
});

export async function createRole(input) {
  const admin = await requirePermission("manage_roles");
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid role." };
  const p = parsed.data;

  const roleId = createId();
  await db.transaction(async (tx) => {
    await tx.insert(roles).values({ id: roleId, name: p.name, desc: p.desc || null, perms: p.perms });
    await logAction(tx, {
      adminId: admin.id, actionType: "Role created", targetType: "role", targetId: roleId,
      note: p.perms.map(PERM_LABEL).join(" · "),
    });
  });

  return { ok: true, roleId };
}

const editRoleSchema = roleSchema.extend({ id: z.string().min(1) });

export async function editRole(input) {
  const admin = await requirePermission("manage_roles");
  const parsed = editRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid role." };
  const p = parsed.data;

  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(roles).where(eq(roles.id, p.id));
    if (!before) throw new Error("Role not found.");

    await tx.update(roles).set({ name: p.name, desc: p.desc || null, perms: p.perms }).where(eq(roles.id, p.id));

    const added = p.perms.filter(perm => !before.perms.includes(perm));
    const gone = before.perms.filter(perm => !p.perms.includes(perm));
    const note = [
      added.length ? "granted " + added.map(PERM_LABEL).join(", ") : "",
      gone.length ? "revoked " + gone.map(PERM_LABEL).join(", ") : "",
    ].filter(Boolean).join(" · ") || "no permission changes";

    await logAction(tx, {
      adminId: admin.id, actionType: "Role edited", targetType: "role", targetId: p.id,
      before: { perms: before.perms }, after: { perms: p.perms }, note,
    });
  });

  return { ok: true };
}

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteRole(input) {
  const admin = await requirePermission("manage_roles");
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Missing role id." };

  await db.transaction(async (tx) => {
    const [role] = await tx.select().from(roles).where(eq(roles.id, parsed.data.id));
    if (!role) throw new Error("Role not found.");
    if (role.seeded) throw new Error("The seeded Owner role can't be deleted.");

    await tx.update(users).set({ roleId: null }).where(eq(users.roleId, role.id));
    await tx.delete(roles).where(eq(roles.id, role.id));
    await logAction(tx, {
      adminId: admin.id, actionType: "Role deleted", targetType: "role", targetId: role.id,
      note: `${role.name} · holders reverted to regular players`,
    });
  });

  return { ok: true };
}

const setUserRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().optional().nullable(),
});

// This is how a regular player becomes an admin, or an admin gets demoted —
// there's no separate signup path. A user holds at most one role.
export async function setUserRole(input) {
  const admin = await requirePermission("manage_roles");
  const parsed = setUserRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { userId, roleId } = parsed.data;

  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error("User not found.");

    const [newRole] = roleId ? await tx.select().from(roles).where(eq(roles.id, roleId)) : [null];
    const [prevRole] = user.roleId ? await tx.select().from(roles).where(eq(roles.id, user.roleId)) : [null];

    await tx.update(users).set({ roleId: roleId || null }).where(eq(users.id, userId));

    await logAction(tx, {
      adminId: admin.id,
      actionType: roleId ? (user.roleId ? "Role changed" : "Role assigned") : "Admin access removed",
      targetType: "user",
      targetId: userId,
      note: roleId
        ? (prevRole ? `Replaced ${prevRole.name}` : "Promoted from regular player") + (newRole ? " · grants " + newRole.perms.map(PERM_LABEL).join(", ") : "")
        : "Reverted to regular player",
    });
  });

  return { ok: true };
}

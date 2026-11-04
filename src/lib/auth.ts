import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { authSessions, companies, users, userRoles, roles, rolePermissions, permissions } from "@/db/schema";

export async function currentUser() {
  const session = await auth();
  const userId = session?.user?.id;
  const sessionId = session?.user?.sessionId;
  if (!userId || !sessionId) return null;
  const [row] = await db.select({ user: users, roleName: roles.name, companyName:companies.name })
    .from(authSessions).innerJoin(users, eq(authSessions.userId, users.id))
    .innerJoin(companies,eq(companies.id,users.companyId))
    .leftJoin(userRoles, eq(userRoles.userId, users.id)).leftJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(authSessions.id, sessionId), eq(users.id, userId), gt(authSessions.expiresAt, new Date()), eq(users.active, true)));
  const companyId = row?.user.companyId;
  if (!row || !companyId) return null;
  return { ...row.user, companyId, roleName: row.roleName, companyName:row.companyName };
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function hasPermission(userId: string, permissionKey: string) {
  const [row] = await db.select({ id: permissions.id }).from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(userRoles.userId, userId), eq(permissions.key, permissionKey))).limit(1);
  return Boolean(row);
}

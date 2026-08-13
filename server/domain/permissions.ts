import type { AuthUser } from "../auth/jwt";

export function canDeleteEvent(
  user: AuthUser,
  event: { createdById: number },
): boolean {
  return user.role === "ADMIN" || event.createdById === user.userId;
}

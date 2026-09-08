import type { AuthUser } from "../auth/jwt";

export function canDeleteEvent(
  user: AuthUser,
  event: { createdById: number },
): boolean {
  return user.role === "ADMIN" || event.createdById === user.userId;
}

export function canEditEvent(
  user: AuthUser,
  event: { createdById: number },
): boolean {
  return user.role === "ADMIN" || event.createdById === user.userId;
}

export function canDeleteComment(
  user: AuthUser,
  comment: { authorId: number | null },
): boolean {
  return user.role === "ADMIN" || comment.authorId === user.userId;
}

export function canDeleteHandleComment(
  handleId: number,
  comment: { handleId: number | null },
): boolean {
  return comment.handleId === handleId;
}

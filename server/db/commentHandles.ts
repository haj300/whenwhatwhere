import { prisma } from "./events";
import type { CommentHandle } from "@prisma/client";
import { getUserByUsername } from "./users";

export async function getCommentHandleByUsername(
  username: string,
): Promise<CommentHandle | null> {
  return prisma.commentHandle.findUnique({ where: { username } });
}

// Checked against both tables: a name is either a real invited user's
// username or a reserved anonymous handle, never both. Used identically by
// every code path that needs to know "is this name taken" — the comment
// route (both the plain-anonymous and the reserve branch) — so the check
// never drifts into two different implementations.
export async function isNameReserved(username: string): Promise<boolean> {
  const [handle, user] = await Promise.all([
    getCommentHandleByUsername(username),
    getUserByUsername(username),
  ]);
  return handle !== null || user !== null;
}

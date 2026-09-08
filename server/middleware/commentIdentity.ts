import type { Context } from "koa";
import type { Role } from "@prisma/client";
import { verifyToken } from "../auth/jwt";
import { verifyHandleToken } from "../auth/handleSession";

export type CommentIdentity =
  | { kind: "user"; userId: number; role: Role }
  | { kind: "handle"; handleId: number; username: string }
  | { kind: "anonymous" };

export function getCommentIdentity(ctx: Context): CommentIdentity {
  const token = ctx.cookies.get("token");
  if (token) {
    try {
      const payload = verifyToken(token);
      return { kind: "user", userId: payload.userId, role: payload.role };
    } catch {
      // fall through — try a handle session next
    }
  }
  const handleToken = ctx.cookies.get("handleToken");
  if (handleToken) {
    try {
      const payload = verifyHandleToken(handleToken);
      return { kind: "handle", handleId: payload.handleId, username: payload.username };
    } catch {
      // fall through — anonymous
    }
  }
  return { kind: "anonymous" };
}

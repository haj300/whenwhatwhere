import { verifyToken } from "../auth/jwt";
import type { Context, Next } from "koa";

export async function requireAuth(ctx: Context, next: Next) {
  const cookie = ctx.cookies.get("token");
  if (!cookie) {
    ctx.status = 401;
    ctx.body = { error: "Authorization token missing" };
    return;
  }
  try {
    ctx.state.user = verifyToken(cookie);
  } catch (err) {
    ctx.status = 401;
    ctx.body = { error: "Invalid authorization token" };
    return;
  }
  await next();
}

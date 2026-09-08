import Router from "@koa/router";
import { getCommentHandleByUsername } from "../db/commentHandles";
import { signHandleToken, verifyHandleToken, handleCookieOpts } from "../auth/handleSession";
import { handleLoginLimiter, handleLoginIpLimiter } from "../auth/rateLimit";

export const commentHandlesRouter = new Router();

commentHandlesRouter.post("/comment-handles/login", async (ctx) => {
  const body = ctx.request.body as { username?: unknown; password?: unknown };
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const ip = ctx.ip;
  if (!handleLoginIpLimiter.consume(ip) || !handleLoginLimiter.consume(username)) {
    ctx.status = 429;
    ctx.body = { error: "Too many login attempts. Try again later." };
    return;
  }

  const handle = await getCommentHandleByUsername(username);
  // Verify against a hash either way, even for an unknown username, so a
  // missing handle doesn't respond faster than a wrong password (a timing
  // side-channel revealing which names are registered) — same pattern as
  // /auth/login.
  const dummyHash =
    "$argon2id$v=19$m=65536,t=2,p=1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
  const passwordOk = await Bun.password.verify(password, handle?.passwordHash ?? dummyHash);

  if (!handle || !passwordOk) {
    ctx.status = 401;
    ctx.body = { error: "Fel namn eller lösenord" };
    return;
  }

  handleLoginLimiter.reset(username);
  handleLoginIpLimiter.reset(ip);
  const token = signHandleToken({ handleId: handle.id, username: handle.username });
  ctx.cookies.set("handleToken", token, handleCookieOpts);
  ctx.status = 204;
});

commentHandlesRouter.get("/comment-handles/me", async (ctx) => {
  const cookie = ctx.cookies.get("handleToken");
  if (!cookie) {
    ctx.status = 401;
    return;
  }
  try {
    const payload = verifyHandleToken(cookie);
    ctx.body = { handleId: payload.handleId, username: payload.username };
  } catch {
    ctx.status = 401;
  }
});

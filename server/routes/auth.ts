import Router from "@koa/router";
import { getUserByEmail, getUserById, createUser } from "../db/users";
import { getInviteByTokenHash, deleteInvite } from "../db/invites";
import { hashToken } from "../auth/tokens";
import { signToken, verifyToken } from "../auth/jwt";
import { loginLimiter } from "../auth/rateLimit";
import { requireAuth } from "../middleware/auth";
import { validatePassword } from "../domain/password";

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms — matches the JWT expiry
};

export const authRouter = new Router();

authRouter.post("/auth/setup", async (ctx) => {
  const body = ctx.request.body as {
    password?: unknown;
    inviteToken?: unknown;
  };
  const password = typeof body.password === "string" ? body.password : "";
  const inviteToken =
    typeof body.inviteToken === "string" ? body.inviteToken : "";

  const passwordError = validatePassword(password);
  if (passwordError) {
    ctx.status = 400;
    ctx.body = { error: passwordError };
    return;
  }

  const invite = await getInviteByTokenHash(hashToken(inviteToken));
  if (!invite || invite.expiresAt < new Date()) {
    ctx.status = 400;
    ctx.body = { error: "Invalid or expired invite" };
    return;
  }
  const existingUser = await getUserByEmail(invite.email);
  if (existingUser) {
    ctx.status = 400;
    ctx.body = { error: "User already exists" };
    return;
  }

  const passwordHash = await Bun.password.hash(password);

  const user = await createUser({
    email: invite.email,
    passwordHash,
    role: invite.role,
  });

  await deleteInvite(invite.id);

  const token = signToken({ userId: user.id, role: user.role });
  ctx.cookies.set("token", token, cookieOpts);
  ctx.status = 201;
  ctx.body = { email: user.email, role: user.role };
});

authRouter.post("/auth/login", async (ctx) => {
  const body = ctx.request.body as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Rate-limit by email, not IP: stays meaningful behind shared/proxied
  // IPs and stops repeated guesses against one specific account.
  if (!loginLimiter.check(email)) {
    ctx.status = 429;
    ctx.body = { error: "Too many login attempts. Try again later." };
    return;
  }

  const user = await getUserByEmail(email);
  // Verify against a hash either way, even for an unknown email, so a
  // missing account doesn't respond faster than a wrong password
  // (a timing side-channel that reveals which emails are registered).
  const dummyHash =
    "$argon2id$v=19$m=65536,t=2,p=1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
  const passwordOk = await Bun.password.verify(
    password,
    user?.passwordHash ?? dummyHash,
  );

  if (!user || !passwordOk) {
    loginLimiter.recordFailure(email);
    ctx.status = 401;
    ctx.body = { error: "Invalid email or password" };
    return;
  }

  loginLimiter.reset(email);
  const token = signToken({ userId: user.id, role: user.role });
  ctx.cookies.set("token", token, cookieOpts);
  ctx.status = 204;
});

authRouter.get("/auth/me", requireAuth, async (ctx) => {
  ctx.body = { userId: ctx.state.user.userId, role: ctx.state.user.role };
});

authRouter.post("/auth/logout", async (ctx) => {
  // maxAge: 0 expires the cookie immediately; same attributes as when it
  // was set so the browser matches and clears the right cookie.
  ctx.cookies.set("token", "", { ...cookieOpts, maxAge: 0 });
  ctx.status = 204;
});

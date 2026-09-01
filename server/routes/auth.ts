import Router from "@koa/router";
import { Prisma } from "@prisma/client";
import { getUserByEmail, getUserById, createUser } from "../db/users";
import { getInviteByTokenHash, deleteInvite } from "../db/invites";
import { hashToken } from "../auth/tokens";
import { signToken, verifyToken } from "../auth/jwt";
import { loginLimiter, loginIpLimiter } from "../auth/rateLimit";
import { requireAuth } from "../middleware/auth";
import { validatePassword } from "../domain/password";
import { validateUsername } from "../domain/username";

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
    username?: unknown;
  };
  const password = typeof body.password === "string" ? body.password : "";
  const inviteToken =
    typeof body.inviteToken === "string" ? body.inviteToken : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";

  const passwordError = validatePassword(password);
  if (passwordError) {
    ctx.status = 400;
    ctx.body = { error: passwordError };
    return;
  }

  const usernameError = validateUsername(username);
  if (usernameError) {
    ctx.status = 400;
    ctx.body = { error: usernameError };
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

  let user;
  try {
    user = await createUser({
      email: invite.email,
      passwordHash,
      role: invite.role,
      username,
    });
  } catch (e) {
    // The unique constraint on `username` is the actual gate here — not a
    // separate findUnique-then-create check, which would leave a race
    // window between two concurrent setups picking the same name.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      ctx.status = 409;
      ctx.body = { error: "Username already taken" };
      return;
    }
    throw e;
  }

  await deleteInvite(invite.id);

  const token = signToken({ userId: user.id, role: user.role });
  ctx.cookies.set("token", token, cookieOpts);
  ctx.status = 201;
  ctx.body = { email: user.email, role: user.role, username: user.username };
});

authRouter.post("/auth/login", async (ctx) => {
  const body = ctx.request.body as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Two rate-limit dimensions, both required. The per-email limiter stops
  // repeated guesses against one specific account; the per-IP limiter stops
  // cross-account credential stuffing where an attacker cycles email
  // addresses (each getting a fresh per-email counter) from one source IP.
  // consume() atomically counts this attempt *before* any await, so a burst
  // of concurrent requests can't all slip past the gate in the same event-loop
  // tick before the counter is written (TOCTOU race, CWE-362). A successful
  // login resets both counters below.
  const ip = ctx.ip;
  if (!loginIpLimiter.consume(ip) || !loginLimiter.consume(email)) {
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
    // The failed attempt was already counted by consume() above.
    ctx.status = 401;
    ctx.body = { error: "Invalid email or password" };
    return;
  }

  // Successful login: clear the pre-counted attempt on both dimensions.
  loginLimiter.reset(email);
  loginIpLimiter.reset(ip);
  const token = signToken({ userId: user.id, role: user.role });
  ctx.cookies.set("token", token, cookieOpts);
  ctx.status = 204;
});

authRouter.get("/auth/me", requireAuth, async (ctx) => {
  const user = await getUserById(ctx.state.user.userId);
  ctx.body = {
    userId: ctx.state.user.userId,
    role: ctx.state.user.role,
    username: user?.username ?? null,
  };
});

authRouter.post("/auth/logout", async (ctx) => {
  // maxAge: 0 expires the cookie immediately; same attributes as when it
  // was set so the browser matches and clears the right cookie.
  ctx.cookies.set("token", "", { ...cookieOpts, maxAge: 0 });
  ctx.status = 204;
});

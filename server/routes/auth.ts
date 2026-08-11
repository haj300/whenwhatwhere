import Router from "@koa/router";
import { getUserByEmail, getUserById, createUser } from "../db/users";
import { getInviteByTokenHash, deleteInvite } from "../db/invites";
import { hashToken } from "../auth/tokens";
import { signToken, verifyToken } from "../auth/jwt";
import { loginLimiter } from "../auth/rateLimit";

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

  const invite = await getInviteByTokenHash(hashToken(inviteToken));
  if (!invite) {
    ctx.status = 400;
    ctx.body = { error: "Invalid invite token" };
    return;
  }
  const existingUser = await getUserByEmail(invite.email);
  if (existingUser) {
    ctx.status = 400;
    ctx.body = { error: "User already exists" };
    return;
  }

  const passwordHash = Bun.passwordHash(password);

  const user = await createUser({
    email: invite.email,
    passwordHash,
    role: invite.role,
  });

  await deleteInvite(invite.id);

  const token = signToken({ userId: user.id, role: user.role });
  ctx.cookies.set("token", token, cookieOpts);
});

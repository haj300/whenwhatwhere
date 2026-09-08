import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  throw new Error(
    "JWT_SECRET missing or shorter than 32 chars — refusing to start",
  );
}

// Derived, not a second secret to configure: a token signed with this key
// can never verify against the real login secret in ../auth/jwt.ts, or vice
// versa — even if some future code reads the wrong cookie into the wrong
// verify function, the signature check itself fails closed.
const HANDLE_SECRET = crypto
  .createHmac("sha256", secret)
  .update("comment-handle-session")
  .digest("hex");

export type HandleSession = { handleId: number; username: string };

export function signHandleToken(payload: HandleSession): string {
  return jwt.sign(payload, HANDLE_SECRET, { expiresIn: "2h" });
}

export function verifyHandleToken(token: string): HandleSession {
  return jwt.verify(token, HANDLE_SECRET) as HandleSession;
}

export const handleCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 2 * 60 * 60 * 1000, // 2 hours — matches the handle-token expiry
};

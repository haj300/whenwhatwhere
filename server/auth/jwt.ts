import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

export type AuthUser = {
  userId: number;
  role: Role;
};

const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  throw new Error(
    "JWT_SECRET missing or shorter than 32 chars — refusing to start",
  );
}

const SECRET: string = secret;

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, SECRET) as AuthUser;
}

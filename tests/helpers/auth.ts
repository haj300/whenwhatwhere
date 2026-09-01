import type { Role } from "@prisma/client";
import { prisma } from "../../server/db/events";
import { signToken } from "../../server/auth/jwt";

let counter = 0;

export async function makeUser(role: Role = "CONTRIBUTOR", username?: string) {
  counter += 1;
  const email = `user${counter}@test.local`;
  const passwordHash = await Bun.password.hash("password123");
  console.log(passwordHash);
  return prisma.user.create({ data: { email, passwordHash, role, username } });
}

export function authCookie(user: { id: number; role: Role }): string {
  return `token=${signToken({ userId: user.id, role: user.role })}`;
}

import type { Role, User } from "@prisma/client";
import { prisma } from "./events";

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function getUserById(id: number): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  role: Role;
}): Promise<User> {
  return prisma.user.create({ data });
}

import type { Invite, Role } from "@prisma/client";
import { prisma } from "./events";

export async function createInvite(data: {
  email: string;
  role: Role;
  tokenHash: string;
  expiresAt: Date;
}): Promise<Invite> {
  return prisma.invite.create({ data });
}

export async function getInviteByTokenHash(tokenHash: string): Promise<Invite | null> {
  return prisma.invite.findUnique({ where: { tokenHash } });
}

export async function deleteInvite(id: number): Promise<void> {
  await prisma.invite.delete({ where: { id } });
}

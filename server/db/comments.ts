import { prisma } from "./events";
import type { Prisma } from "@prisma/client";

export type CommentWithIdentity = Prisma.CommentGetPayload<{
  include: {
    author: { select: { username: true } };
    handle: { select: { username: true } };
  };
}>;

const commentInclude = {
  author: { select: { username: true } },
  handle: { select: { username: true } },
} as const;

export async function listCommentsForEvent(
  eventId: number,
): Promise<CommentWithIdentity[]> {
  return prisma.comment.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" }, // oldest-first
    include: commentInclude,
  });
}

export async function createComment(data: {
  eventId: number;
  body: string;
  authorId?: number;
  handleId?: number;
  displayName?: string | null;
}): Promise<CommentWithIdentity> {
  return prisma.comment.create({ data, include: commentInclude });
}

// Reserving a name is always bundled with posting the first comment under
// it — never a standalone action. Both inserts happen in one transaction so
// a failure partway through never leaves an orphaned reservation with no
// comment behind it.
export async function createHandleAndComment(
  eventId: number,
  username: string,
  passwordHash: string,
  body: string,
): Promise<CommentWithIdentity> {
  return prisma.$transaction(async (tx) => {
    const handle = await tx.commentHandle.create({ data: { username, passwordHash } });
    return tx.comment.create({
      data: { eventId, body, handleId: handle.id },
      include: commentInclude,
    });
  });
}

export async function getCommentById(id: number) {
  return prisma.comment.findUnique({ where: { id } });
}

export async function deleteComment(id: number): Promise<void> {
  await prisma.comment.delete({ where: { id } });
}

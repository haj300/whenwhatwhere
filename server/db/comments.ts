import { Prisma } from "@prisma/client";
import { prisma } from "./events";

export type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: { author: { select: { username: true } } };
}>;

export async function listCommentsForEvent(
  eventId: number,
): Promise<CommentWithAuthor[]> {
  return prisma.comment.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" }, // oldest-first
    include: { author: { select: { username: true } } },
  });
}

export async function createComment(
  eventId: number,
  authorId: number,
  body: string,
): Promise<CommentWithAuthor> {
  return prisma.comment.create({
    data: { eventId, authorId, body },
    include: { author: { select: { username: true } } },
  });
}

export async function getCommentById(id: number) {
  return prisma.comment.findUnique({ where: { id } });
}

export async function deleteComment(id: number): Promise<void> {
  await prisma.comment.delete({ where: { id } });
}

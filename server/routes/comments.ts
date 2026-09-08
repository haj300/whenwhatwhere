import { Prisma } from "@prisma/client";
import Router from "@koa/router";
import { getEventById } from "../db/events";
import {
  listCommentsForEvent,
  createComment,
  createHandleAndComment,
  getCommentById,
  deleteComment,
} from "../db/comments";
import { isNameReserved } from "../db/commentHandles";
import { validateNewComment } from "../domain/comments";
import { canDeleteComment, canDeleteHandleComment } from "../domain/permissions";
import { getCommentIdentity } from "../middleware/commentIdentity";
import { signHandleToken, handleCookieOpts } from "../auth/handleSession";
import { commentLimiter, anonCommentLimiter } from "../auth/rateLimit";

export const commentsRouter = new Router();

const NAME_TAKEN_ERROR = "Det namnet är reserverat — logga in eller välj ett annat";

commentsRouter.get("/event/:id/comments", async (ctx) => {
  const eventId = Number(ctx.params.id);
  if (isNaN(eventId)) {
    ctx.status = 404;
    return;
  }
  ctx.body = await listCommentsForEvent(eventId);
});

commentsRouter.post("/event/:id/comments", async (ctx) => {
  const eventId = Number(ctx.params.id);
  if (isNaN(eventId)) {
    ctx.status = 404;
    return;
  }
  if (!(await getEventById(eventId))) {
    ctx.status = 404;
    return;
  }

  const identity = getCommentIdentity(ctx);
  const limiter = identity.kind === "user" ? commentLimiter : anonCommentLimiter;
  const limiterKey = identity.kind === "user" ? String(identity.userId) : ctx.ip;
  if (!limiter.consume(limiterKey)) {
    ctx.status = 429;
    ctx.body = { error: "Too many comments, slow down" };
    return;
  }

  const result = validateNewComment(ctx.request.body);
  if (!result.ok) {
    ctx.status = 400;
    ctx.body = { errors: result.errors };
    return;
  }
  const { body, name, reserve, password } = result.comment;

  if (identity.kind === "user") {
    const comment = await createComment({ eventId, body, authorId: identity.userId });
    ctx.status = 201;
    ctx.body = comment;
    return;
  }

  if (identity.kind === "handle") {
    const comment = await createComment({ eventId, body, handleId: identity.handleId });
    ctx.status = 201;
    ctx.body = comment;
    return;
  }

  // identity.kind === "anonymous"
  if (reserve && name && password) {
    if (await isNameReserved(name)) {
      ctx.status = 409;
      ctx.body = { error: NAME_TAKEN_ERROR };
      return;
    }
    const passwordHash = await Bun.password.hash(password);
    try {
      const comment = await createHandleAndComment(eventId, name, passwordHash, body);
      ctx.cookies.set(
        "handleToken",
        signHandleToken({ handleId: comment.handleId!, username: name }),
        handleCookieOpts,
      );
      ctx.status = 201;
      ctx.body = comment;
    } catch (e) {
      // A concurrent request claimed the exact same name in the gap between
      // the isNameReserved() check above and this insert — the unique
      // constraint on CommentHandle.username is the real, race-safe gate.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        (e.meta?.target as string[] | undefined)?.includes("username")
      ) {
        ctx.status = 409;
        ctx.body = { error: NAME_TAKEN_ERROR };
        return;
      }
      throw e;
    }
    return;
  }

  if (name && (await isNameReserved(name))) {
    ctx.status = 409;
    ctx.body = { error: NAME_TAKEN_ERROR };
    return;
  }

  const comment = await createComment({ eventId, body, displayName: name });
  ctx.status = 201;
  ctx.body = comment;
});

commentsRouter.delete("/comment/:id", async (ctx) => {
  const id = Number(ctx.params.id);
  if (isNaN(id)) {
    ctx.status = 404;
    return;
  }
  const existing = await getCommentById(id);
  if (!existing) {
    ctx.status = 404;
    return;
  }

  const identity = getCommentIdentity(ctx);
  if (identity.kind === "anonymous") {
    ctx.status = 401;
    return;
  }
  const allowed =
    identity.kind === "user"
      ? canDeleteComment(identity, existing)
      : canDeleteHandleComment(identity.handleId, existing);
  if (!allowed) {
    ctx.status = 403;
    return;
  }
  await deleteComment(id);
  ctx.status = 204;
});

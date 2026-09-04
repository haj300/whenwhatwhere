import Router from "@koa/router";
import { getEventById } from "../db/events";
import {
  listCommentsForEvent,
  createComment,
  getCommentById,
  deleteComment,
} from "../db/comments";
import { validateNewComment } from "../domain/comments";
import { canDeleteComment } from "../domain/permissions";
import { requireAuth } from "../middleware/auth";
import { commentLimiter } from "../auth/rateLimit";

export const commentsRouter = new Router();

commentsRouter.get("/event/:id/comments", async (ctx) => {
  const eventId = Number(ctx.params.id);
  if (isNaN(eventId)) {
    ctx.status = 404;
    return;
  }
  ctx.body = await listCommentsForEvent(eventId);
});

commentsRouter.post("/event/:id/comments", requireAuth, async (ctx) => {
  const eventId = Number(ctx.params.id);
  if (isNaN(eventId)) {
    ctx.status = 404;
    return;
  }
  if (!(await getEventById(eventId))) {
    ctx.status = 404;
    return;
  }
  if (!commentLimiter.consume(String(ctx.state.user.userId))) {
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
  const comment = await createComment(
    eventId,
    ctx.state.user.userId,
    result.comment.body,
  );
  ctx.status = 201;
  ctx.body = comment;
});

commentsRouter.delete("/comment/:id", requireAuth, async (ctx) => {
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
  if (!canDeleteComment(ctx.state.user, existing)) {
    ctx.status = 403;
    return;
  }
  await deleteComment(id);
  ctx.status = 204;
});

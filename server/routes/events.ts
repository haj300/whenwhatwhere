import Router from "@koa/router";
import { listEvents, getEventById, createEvent, deleteEvent } from "../db/events";
import { validateNewEvent } from "../domain/events";

export const eventsRouter = new Router();

eventsRouter.get("/events", async (ctx) => {
  ctx.body = await listEvents();
});

eventsRouter.get("/event/:id", async (ctx) => {
  const id = Number(ctx.params.id);
  if (isNaN(id)) { ctx.status = 404; return; }
  const event = await getEventById(id);
  if (!event) { ctx.status = 404; return; }
  ctx.body = event;
});

eventsRouter.post("/addEvent", async (ctx) => {
  const result = validateNewEvent(ctx.request.body);
  if (!result.ok) {
    ctx.status = 400;
    ctx.body = { errors: result.errors };
    return;
  }
  const event = await createEvent(result.event);
  ctx.status = 201;
  ctx.body = event;
});

eventsRouter.delete("/event/:id", async (ctx) => {
  const id = Number(ctx.params.id);
  if (isNaN(id)) { ctx.status = 404; return; }
  const existing = await getEventById(id);
  if (!existing) { ctx.status = 404; return; }
  await deleteEvent(id);
  ctx.status = 204;
});

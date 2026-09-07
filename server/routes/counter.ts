import Router from "@koa/router";
import { incrementHits } from "../db/counter";

export const counterRouter = new Router();

// One page load = one hit. Returns the new total so the footer can show it.
counterRouter.post("/counter/hit", async (ctx) => {
  ctx.body = { hits: await incrementHits() };
});

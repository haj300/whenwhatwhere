const Koa = require("koa");
const Router = require("@koa/router");
const serve = require("koa-static");

const app = new Koa();
const router = new Router();

app.use(serve("public"));

router.post("/event", async (ctx: { request: { body: any }; body: any }) => {
  const eventData = ctx.request.body;
  // send to db
  ctx.body = eventData;
});

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

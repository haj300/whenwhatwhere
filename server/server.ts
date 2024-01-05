import dotenv from "dotenv";
import {PrismaClient} from ".prisma/client";

const Koa = require("koa");
const Router = require("@koa/router");
const serve = require("koa-static");
const app = new Koa();
const router = new Router();
const prisma = new PrismaClient();

dotenv.config();

app.use(serve("public"));



//Db test code
prisma.$connect();
prisma.event.findMany().then((events) => {
  console.log(events);
});

router.get("/home", async (ctx: { body: { title: string } }) => {
  const responseData = { title: "whenwhatwhere" };
  ctx.body = responseData;
});

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

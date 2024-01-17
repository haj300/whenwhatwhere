import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const Koa = require("koa");
const Router = require("@koa/router");
const { bodyParser } = require("@koa/bodyparser");
const serve = require("koa-static");
const app = new Koa();
const router = new Router();
const prisma = new PrismaClient();
const path = require("path");

dotenv.config();

app.use(serve(path.join("public")));
app.use(bodyParser());

//connect to db
prisma.$connect();

router.post("/addEvent", async (ctx: { request: { body: any }; body: any }) => {
  const eventData = ctx.request.body;
  console.log("from addEvent", eventData);
  try {
    await prisma.event.create({ data: eventData });
  } catch (error) {
    console.error(error);
  }
  ctx.body = eventData;
});

router.get("/events", async (ctx: { body: any }) => {
  const events = await prisma.event.findMany();
  ctx.body = events;
  console.log("Events" + events);
});

// Pagination
// router.get("/events", async (ctx: { query: any; body: any }) => {
//   const page = Number(ctx.query.page) || 1;
//   const pageSize = Number(ctx.query.pageSize) || 10;

//   const events = await prisma.event.findMany({
//     take: pageSize,
//     skip: (page - 1) * pageSize,
//     orderBy: {
//       id: 'asc', // or 'desc' for descending order
//     },
//   });

//   ctx.body = events;
// });

router.get(
  "/event/:id",
  async (ctx: { params: { id: any }; body: any; redirect: any }) => {
    console.log(ctx.params.id);
    const { id } = ctx.params;
    const event = await prisma.event.findUnique({
      where: {
        id: Number(id),
      },
    });
    ctx.redirect(`/event.html?id=${ctx.params.id}`);
    ctx.body = event;
  },
);

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

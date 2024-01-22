import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Storage } from "@google-cloud/storage";

const Koa = require("koa");
const Router = require("@koa/router");
const serve = require("koa-static");
const app = new Koa();
const router = new Router();
const prisma = new PrismaClient();
const path = require("path");
const { koaBody } = require("koa-body");
const fs = require("fs");

dotenv.config();

app.use(serve(path.join("public")));

prisma.$connect();

const storageClient = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_APPLICATION_CREDENTIALS,
});
const bucketName = process.env.GCLOUD_STORAGE_BUCKET || "";
const bucket = storageClient.bucket(bucketName);

router.post("/uploadImage", koaBody({ multipart: true }), async (ctx: any) => {
  const file = ctx.request.files.file[0];
  const gcsFile = bucket.file(file.newFilename);

  await new Promise((resolve, reject) => {
    fs.createReadStream(file.filepath)
      .pipe(gcsFile.createWriteStream())
      .on("error", reject)
      .on("finish", resolve);
  });

  ctx.body = `https://storage.googleapis.com/${
    bucket.name
  }/${encodeURIComponent(file.newFilename)}`;
});

router.post("/addEvent", koaBody({ multipart: true }), async (ctx: any) => {
  console.log(JSON.stringify(ctx.request.body, null, 2));
  const eventData = {
    name: ctx.request.body.name,
    description: ctx.request.body.description,
    time: ctx.request.body.time,
    date: ctx.request.body.date,
    location: ctx.request.body.location,
    image: ctx.request.body.image,
  };

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
});

router.get(
  "/event/:id",
  async (ctx: {
    params: { id: any };
    body: any;
    redirect: any;
    status: any;
  }) => {
    const { id } = ctx.params;

    try {
      const event = await prisma.event.findUnique({
        where: {
          id: Number(id),
        },
      });
      ctx.body = event;
      console.log(ctx.body);
      ctx.redirect(`/event.html?id=${ctx.params.id}`);
    } catch (error) {
      ctx.status = 404;
      console.error(error);
    }
  },
);

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

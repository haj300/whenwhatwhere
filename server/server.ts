import fs from "fs";
import path from "path";
import Koa from "koa";
import { koaBody } from "koa-body";
import serve from "koa-static";
import Router from "@koa/router";
import { Prisma, PrismaClient } from "@prisma/client";
import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";

dotenv.config();

const app = new Koa();
const router = new Router();
const prisma = new PrismaClient();
const storageClient = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_APPLICATION_CREDENTIALS,
});
const bucketName = process.env.GCLOUD_STORAGE_BUCKET || "";
const bucket = storageClient.bucket(bucketName);

app.use(serve(path.join("public")));

// Connect to Prisma
prisma.$connect();

// Route handlers
const uploadImage = async (ctx: any) => {
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
};

const addEvent = async (ctx: any) => {
  const eventData = {
    name: ctx.request.body.name,
    description: ctx.request.body.description,
    time: ctx.request.body.time,
    date: ctx.request.body.date,
    location: ctx.request.body.location,
    image: ctx.request.body.image,
  };

  try {
    const event = await prisma.event.create({ data: eventData });
    ctx.status = 201;
    ctx.body = event;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // This is a validation error
      ctx.status = 400;
      ctx.body = { error: error.message };
    } else {
      // This is an unexpected error
      ctx.status = 500;
      ctx.body = { error: (error as any).message };
      console.error(error);
    }
  }
};

const getEvents = async (ctx: { body: any }) => {
  const events = await prisma.event.findMany();
  ctx.body = events;
};

const getEventById = async (ctx: {
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
};

router.post("/uploadImage", koaBody({ multipart: true }), uploadImage);
router.post("/addEvent", koaBody({ multipart: true }), addEvent);
router.get("/event/:id", getEventById);
router.get("/events", getEvents);

app.use(router.routes());
app.use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

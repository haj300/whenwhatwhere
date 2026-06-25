import fs from "fs";
import path from "path";
import Koa from "koa";
import Router from "@koa/router";
import { koaBody } from "koa-body";
import serve from "koa-static";
import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";
import { eventsRouter } from "./routes/events";

dotenv.config();

export const app = new Koa();

// ── error middleware ────────────────────────────────────────────
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Internal server error" };
  }
});

// ── static files ────────────────────────────────────────────────
app.use(serve(path.join("public")));

// ── GCS upload (untouched) ──────────────────────────────────────
const storageClient = new Storage({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: process.env.GCLOUD_APPLICATION_CREDENTIALS,
});
const bucketName = process.env.GCLOUD_STORAGE_BUCKET || "";
const bucket = storageClient.bucket(bucketName);

const uploadImageHandler = async (ctx: any) => {
  const files = ctx.request.files?.file;
  const file = Array.isArray(files) ? files[0] : files;
  if (!file) {
    ctx.status = 400;
    ctx.body = { error: "No file provided" };
    return;
  }
  const gcsFile = bucket.file(file.newFilename);
  await new Promise((resolve, reject) => {
    fs.createReadStream(file.filepath)
      .pipe(gcsFile.createWriteStream())
      .on("error", reject)
      .on("finish", resolve);
  });
  ctx.body = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(file.newFilename)}`;
};

// ── routes ──────────────────────────────────────────────────────
app.use(koaBody({ multipart: true }));
app.use(eventsRouter.routes());
app.use(eventsRouter.allowedMethods());

const uploadRouter = new Router();
uploadRouter.post("/uploadImage", uploadImageHandler);
app.use(uploadRouter.routes());

// ── listen (skipped when imported by tests) ─────────────────────
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

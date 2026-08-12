import fs from "fs";
import path from "path";
import Koa from "koa";
import Router from "@koa/router";
import { koaBody } from "koa-body";
import serve from "koa-static";
import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";
import { eventsRouter } from "./routes/events";
import { authRouter } from "./routes/auth";

dotenv.config();

export const app = new Koa();

// ── security headers ────────────────────────────────────────────
app.use(async (ctx, next) => {
  ctx.set("X-Content-Type-Options", "nosniff");
  ctx.set("X-Frame-Options", "DENY");
  ctx.set("Referrer-Policy", "no-referrer");
  ctx.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  ctx.set(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' https://storage.googleapis.com; frame-ancestors 'none'"
  );
  if (ctx.secure) {
    ctx.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  await next();
});

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

// ── image upload: GCS in production, local filesystem in dev ────
// When GCLOUD_STORAGE_BUCKET is set we stream to Google Cloud Storage.
// Otherwise (local dev) we save under public/uploads/ and serve it as a
// static file — so local development needs no cloud credentials at all.
const bucketName = process.env.GCLOUD_STORAGE_BUCKET || "";
const bucket = bucketName
  ? new Storage({
      projectId: process.env.GCLOUD_PROJECT_ID,
      keyFilename: process.env.GCLOUD_APPLICATION_CREDENTIALS,
    }).bucket(bucketName)
  : null;

const UPLOAD_DIR = path.join("public", "uploads");

const uploadImageHandler = async (ctx: any) => {
  const files = ctx.request.files?.file;
  const file = Array.isArray(files) ? files[0] : files;
  if (!file) {
    ctx.status = 400;
    ctx.body = { error: "No file provided" };
    return;
  }

  // Production: stream the upload straight to Google Cloud Storage.
  if (bucket) {
    const gcsFile = bucket.file(file.newFilename);
    await new Promise((resolve, reject) => {
      fs.createReadStream(file.filepath)
        .pipe(gcsFile.createWriteStream())
        .on("error", reject)
        .on("finish", resolve);
    });
    ctx.body = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(file.newFilename)}`;
    return;
  }

  // Local dev: copy into public/uploads/ and return a same-origin URL.
  // path.basename() strips any directory components from the generated
  // name, so a crafted filename can't escape the uploads folder
  // (path-traversal protection).
  const safeName = path.basename(file.newFilename);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  await fs.promises.copyFile(file.filepath, path.join(UPLOAD_DIR, safeName));
  ctx.body = `/uploads/${encodeURIComponent(safeName)}`;
};

// ── routes ──────────────────────────────────────────────────────
app.use(koaBody({ multipart: true }));
app.use(authRouter.routes());
app.use(authRouter.allowedMethods());
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

import fs from "fs";
import path from "path";
import Koa from "koa";
import Router from "@koa/router";
import { koaBody } from "koa-body";
import serve from "koa-static";
import dotenv from "dotenv";
import { eventsRouter } from "./routes/events";
import { authRouter } from "./routes/auth";

dotenv.config();

export const app = new Koa();

// In production, TLS is terminated by nginx — the app only ever sees
// plain HTTP from it. `proxy = true` tells Koa to trust the
// X-Forwarded-Proto header nginx sets, so `ctx.secure` (and therefore
// the HSTS header below) reflects the original HTTPS request. Safe only
// because the app has no public port of its own — nginx is the only
// thing that can ever reach it, so nothing else can forge that header.
app.proxy = true;

// ── security headers ────────────────────────────────────────────
app.use(async (ctx, next) => {
  ctx.set("X-Content-Type-Options", "nosniff");
  ctx.set("X-Frame-Options", "DENY");
  ctx.set("Referrer-Policy", "no-referrer");
  ctx.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  ctx.set(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' blob:; frame-ancestors 'none'"
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

// ── image upload: local filesystem ───────────────────────────────
// Uploaded images are saved under public/uploads/ and served as static
// files. In production this directory is a persistent Volume mount
// (see app.container) so images survive redeploys.
const UPLOAD_DIR = path.join("public", "uploads");

const uploadImageHandler = async (ctx: any) => {
  const files = ctx.request.files?.file;
  const file = Array.isArray(files) ? files[0] : files;
  if (!file) {
    ctx.status = 400;
    ctx.body = { error: "No file provided" };
    return;
  }

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

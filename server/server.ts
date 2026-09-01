import fs from "fs";
import path from "path";
import Koa from "koa";
import Router from "@koa/router";
import { koaBody } from "koa-body";
import serve from "koa-static";
import dotenv from "dotenv";
import { eventsRouter } from "./routes/events";
import { authRouter } from "./routes/auth";
import { requireAuth } from "./middleware/auth";

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

// Files under public/uploads/ are served from the app's own origin, so the
// content type is security-relevant: an uploaded .html/.js would satisfy the
// same-origin CSP and execute as stored XSS. Restrict uploads to real image
// formats by inspecting the leading bytes (magic number) — the authoritative
// check, since the client-supplied MIME type and filename are attacker-
// controlled. Returns the detected MIME type, or null if not an allowed image.
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

async function sniffImageMime(filepath: string): Promise<string | null> {
  const fd = await fs.promises.open(filepath, "r");
  try {
    const buf = Buffer.alloc(12);
    const { bytesRead } = await fd.read(buf, 0, 12, 0);
    if (bytesRead >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
      return "image/jpeg";
    if (
      bytesRead >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    )
      return "image/png";
    if (bytesRead >= 6 && buf.toString("ascii", 0, 3) === "GIF")
      return "image/gif";
    if (
      bytesRead >= 12 &&
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP"
    )
      return "image/webp";
    return null;
  } finally {
    await fd.close();
  }
}

const uploadImageHandler = async (ctx: any) => {
  const files = ctx.request.files?.file;
  const file = Array.isArray(files) ? files[0] : files;
  if (!file) {
    ctx.status = 400;
    ctx.body = { error: "No file provided" };
    return;
  }

  // Confirm the bytes really are an allowed image format before writing into
  // the publicly served uploads directory. This is what prevents an attacker
  // from planting an executable .html/.js payload at a same-origin URL.
  const detectedMime = await sniffImageMime(file.filepath);
  if (!detectedMime || !ALLOWED_IMAGE_MIME.has(detectedMime)) {
    ctx.status = 400;
    ctx.body = { error: "Unsupported file type" };
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
app.use(
  koaBody({ multipart: true, formidable: { maxFileSize: 5 * 1024 * 1024 } })
);
app.use(authRouter.routes());
app.use(authRouter.allowedMethods());
app.use(eventsRouter.routes());
app.use(eventsRouter.allowedMethods());

const uploadRouter = new Router();
uploadRouter.post("/uploadImage", requireAuth, uploadImageHandler);
app.use(uploadRouter.routes());

// ── listen (skipped when imported by tests) ─────────────────────
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

import fs from "fs";
import path from "path";
import sharp from "sharp";
import Koa from "koa";
import Router from "@koa/router";
import { koaBody } from "koa-body";
import serve from "koa-static";
import dotenv from "dotenv";
import { eventsRouter } from "./routes/events";
import { commentsRouter } from "./routes/comments";
import { commentHandlesRouter } from "./routes/commentHandles";
import { counterRouter } from "./routes/counter";
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
    "default-src 'self'; img-src 'self' blob:; frame-ancestors 'none'",
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
// Uploaded images get a far-future cache lifetime: their filenames are
// randomly generated per upload (see uploadImageHandler) and never
// reused, so a browser that already has one will never see stale
// content at the same URL. Everything else (HTML/CSS/JS) keeps
// koa-static's default of no caching, since those filenames don't
// change between deploys and must always be re-fetched.
app.use(async (ctx, next) => {
  if (ctx.path.startsWith("/uploads/")) {
    ctx.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  await next();
});
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
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// koa-static derives the response's Content-Type purely from the file
// extension. Uploaded files are saved under a random, extensionless name
// (see uploadImageHandler), so without this mapping every upload would be
// served as application/octet-stream — which some browsers (notably iOS
// WebKit) handle inconsistently for <img>, including mis-deriving the
// image's intrinsic dimensions.
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

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
    if (
      bytesRead >= 6 &&
      (buf.toString("ascii", 0, 6) === "GIF87a" ||
        buf.toString("ascii", 0, 6) === "GIF89a")
    )
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

// Long edge, in pixels, that an uploaded image is downscaled to. Large
// enough for the full-screen image dialog (90vw/90vh), small enough to
// keep uploads fast on mobile networks.
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 80;
const WEBP_QUALITY = 80;

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
  // (path-traversal protection). The extension is appended from the
  // server-verified detectedMime, never from the client-supplied filename.
  const safeName = `${path.basename(file.newFilename)}${MIME_EXTENSIONS[detectedMime]}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const destPath = path.join(UPLOAD_DIR, safeName);

  if (detectedMime === "image/gif") {
    // sharp would flatten an animated GIF down to a single frame, so
    // GIFs are stored as-is rather than re-encoded.
    await fs.promises.copyFile(file.filepath, destPath);
  } else {
    // .rotate() with no args bakes in the EXIF orientation (phone photos
    // are often stored sideways with a rotation flag) before resizing.
    // Re-encoding also drops all other EXIF metadata (e.g. GPS location)
    // as a side effect, since sharp only keeps it when asked to.
    const image = sharp(file.filepath).rotate().resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });
    if (detectedMime === "image/png") {
      await image.png({ compressionLevel: 9 }).toFile(destPath);
    } else if (detectedMime === "image/webp") {
      await image.webp({ quality: WEBP_QUALITY }).toFile(destPath);
    } else {
      await image.jpeg({ quality: JPEG_QUALITY }).toFile(destPath);
    }
  }

  ctx.body = `/uploads/${encodeURIComponent(safeName)}`;
};

// ── routes ──────────────────────────────────────────────────────
app.use(
  koaBody({ multipart: true, formidable: { maxFileSize: 5 * 1024 * 1024 } }),
);
app.use(authRouter.routes());
app.use(authRouter.allowedMethods());
app.use(eventsRouter.routes());
app.use(eventsRouter.allowedMethods());
app.use(commentsRouter.routes());
app.use(commentsRouter.allowedMethods());
app.use(commentHandlesRouter.routes());
app.use(commentHandlesRouter.allowedMethods());
app.use(counterRouter.routes());
app.use(counterRouter.allowedMethods());

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

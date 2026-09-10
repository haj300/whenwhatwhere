// One-off migration: existing files in public/uploads/ were saved with no
// file extension, so koa-static can't derive their Content-Type (they were
// served as application/octet-stream — see ERRORS.md, 2026-09-09 entry).
// server/server.ts now appends the right extension for new uploads; this
// script fixes the files that already exist, renaming each on disk and
// updating any event.image column that points at the old, extensionless
// path. Safe to re-run — files that already have a recognized extension
// are skipped.
//
// Usage:
//   bun run prisma/fix-upload-extensions.ts            # dry run, no changes
//   bun run prisma/fix-upload-extensions.ts --apply     # actually rename + update DB
import fs from "fs";
import path from "path";
import { prisma } from "../server/db/events";

const UPLOAD_DIR = path.join("public", "uploads");
const APPLY = process.argv.includes("--apply");

const KNOWN_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

// Same magic-number sniff as server.ts's sniffImageMime — duplicated
// deliberately, since this is a one-time script, not part of the running app.
async function sniffExtension(filepath: string): Promise<string | null> {
  const fd = await fs.promises.open(filepath, "r");
  try {
    const buf = Buffer.alloc(12);
    const { bytesRead } = await fd.read(buf, 0, 12, 0);
    if (bytesRead >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
      return ".jpg";
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
      return ".png";
    if (
      bytesRead >= 6 &&
      (buf.toString("ascii", 0, 6) === "GIF87a" ||
        buf.toString("ascii", 0, 6) === "GIF89a")
    )
      return ".gif";
    if (
      bytesRead >= 12 &&
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP"
    )
      return ".webp";
    return null;
  } finally {
    await fd.close();
  }
}

async function main() {
  console.log(APPLY ? "Running migration (--apply)" : "Dry run (pass --apply to write changes)");

  const entries = fs.readdirSync(UPLOAD_DIR);
  let renamed = 0;
  let skippedAlreadyExt = 0;
  let skippedUnrecognized = 0;
  let rowsUpdated = 0;

  for (const name of entries) {
    if (KNOWN_EXTENSIONS.has(path.extname(name).toLowerCase())) {
      skippedAlreadyExt++;
      continue;
    }

    const fullPath = path.join(UPLOAD_DIR, name);
    if (!fs.statSync(fullPath).isFile()) continue;

    const ext = await sniffExtension(fullPath);
    if (!ext) {
      console.warn(`  skip (unrecognized format): ${name}`);
      skippedUnrecognized++;
      continue;
    }

    const newName = `${name}${ext}`;
    const oldUrl = `/uploads/${name}`;
    const newUrl = `/uploads/${newName}`;
    console.log(`  ${oldUrl} -> ${newUrl}`);

    if (APPLY) {
      fs.renameSync(fullPath, path.join(UPLOAD_DIR, newName));
      const result = await prisma.event.updateMany({
        where: { image: oldUrl },
        data: { image: newUrl },
      });
      rowsUpdated += result.count;
    }
    renamed++;
  }

  console.log(
    `\n${APPLY ? "Renamed" : "Would rename"} ${renamed} file(s); ` +
      `${skippedAlreadyExt} already had an extension; ` +
      `${skippedUnrecognized} unrecognized.` +
      (APPLY ? ` Updated ${rowsUpdated} event row(s).` : ""),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

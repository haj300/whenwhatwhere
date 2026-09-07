import { prisma } from "./events";

// Atomically bump the single counter row (id = 1) and return the new total.
// The `increment` runs as `SET hits = hits + 1` in the database, so
// concurrent requests can't lose an update (no read-modify-write race).
// `upsert` seeds the row on the very first hit if the migration didn't.
export async function incrementHits(): Promise<number> {
  const counter = await prisma.counter.upsert({
    where: { id: 1 },
    create: { id: 1, hits: 1 },
    update: { hits: { increment: 1 } },
  });
  return counter.hits;
}

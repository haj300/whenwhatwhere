import { describe, expect, test, beforeAll, afterAll, afterEach } from "bun:test";
import { app } from "../../server/server";
import { prisma } from "../../server/db/events";

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

beforeAll(() => {
  server = app.listen(0);
  const addr = server.address() as { port: number };
  baseUrl = `http://localhost:${addr.port}`;
});

afterAll(async () => {
  await prisma.$disconnect();
  server.close();
});

afterEach(async () => {
  await prisma.event.deleteMany();
});

describe("POST /addEvent", () => {
  test("creates event and returns 201", async () => {
    const res = await fetch(`${baseUrl}/addEvent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New gig",
        description: "Great show",
        date: "2026-10-01T20:00:00.000Z",
        location: "Nalen",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeNumber();
    expect(body.name).toBe("New gig");
  });

  test("returns 400 for missing required fields", async () => {
    const res = await fetch(`${baseUrl}/addEvent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", description: "ok", date: "bad", location: "" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toBeArray();
    expect(body.errors.length).toBeGreaterThan(0);
  });
});

describe("DELETE /event/:id", () => {
  test("deletes event and returns 204", async () => {
    const created = await prisma.event.create({
      data: { name: "To delete", description: "bye", date: new Date("2026-11-01T20:00:00Z"), location: "Somewhere" },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);
    const gone = await prisma.event.findUnique({ where: { id: created.id } });
    expect(gone).toBeNull();
  });

  test("returns 404 for non-existent event", async () => {
    const res = await fetch(`${baseUrl}/event/99999`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("GET /event/:id", () => {
  test("returns event by id", async () => {
    const created = await prisma.event.create({
      data: { name: "Detail gig", description: "desc", date: new Date("2026-09-01T19:00:00Z"), location: "Nalen" },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.name).toBe("Detail gig");
  });

  test("returns 404 for missing event", async () => {
    const res = await fetch(`${baseUrl}/event/99999`);
    expect(res.status).toBe(404);
  });

  test("returns 404 for non-numeric id", async () => {
    const res = await fetch(`${baseUrl}/event/abc`);
    expect(res.status).toBe(404);
  });
});

describe("GET /events", () => {
  test("returns empty array when no events", async () => {
    const res = await fetch(`${baseUrl}/events`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  test("returns saved events", async () => {
    await prisma.event.create({
      data: {
        name: "Test gig",
        description: "A test",
        date: new Date("2026-08-01T20:00:00Z"),
        location: "Debaser",
      },
    });
    const res = await fetch(`${baseUrl}/events`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Test gig");
  });
});

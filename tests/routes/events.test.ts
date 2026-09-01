import { describe, expect, test, beforeAll, afterAll, afterEach } from "bun:test";
import { app } from "../../server/server";
import { prisma } from "../../server/db/events";
import { makeUser, authCookie } from "../helpers/auth";

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

beforeAll(() => {
  server = app.listen(0);
  const addr = server.address() as { port: number };
  baseUrl = `http://localhost:${addr.port}`;
});

afterAll(async () => {
  server.close();
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.invite.deleteMany();
});

describe("POST /addEvent", () => {
  test("rejects unauthenticated requests with 401", async () => {
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
    expect(res.status).toBe(401);
  });

  test("creates event and returns 201 when authenticated", async () => {
    const user = await makeUser();
    const res = await fetch(`${baseUrl}/addEvent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: authCookie(user) },
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
    expect(body.createdById).toBe(user.id);
  });

  test("sets createdById from the token, ignoring any body value", async () => {
    const user = await makeUser();
    const res = await fetch(`${baseUrl}/addEvent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: authCookie(user) },
      body: JSON.stringify({
        name: "Spoof attempt",
        description: "Great show",
        date: "2026-10-01T20:00:00.000Z",
        location: "Nalen",
        createdById: 99999,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.createdById).toBe(user.id);
  });

  test("returns 400 for missing required fields when authenticated", async () => {
    const user = await makeUser();
    const res = await fetch(`${baseUrl}/addEvent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: authCookie(user) },
      body: JSON.stringify({ name: "", description: "ok", date: "bad", location: "" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toBeArray();
    expect(body.errors.length).toBeGreaterThan(0);
  });
});

describe("DELETE /event/:id", () => {
  test("rejects unauthenticated requests with 401", async () => {
    const owner = await makeUser();
    const created = await prisma.event.create({
      data: { name: "To delete", description: "bye", date: new Date("2026-11-01T20:00:00Z"), location: "X", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("owner deletes their event and returns 204", async () => {
    const owner = await makeUser();
    const created = await prisma.event.create({
      data: { name: "To delete", description: "bye", date: new Date("2026-11-01T20:00:00Z"), location: "X", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "DELETE",
      headers: { Cookie: authCookie(owner) },
    });
    expect(res.status).toBe(204);
    const gone = await prisma.event.findUnique({ where: { id: created.id } });
    expect(gone).toBeNull();
  });

  test("contributor cannot delete another user's event (403)", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const created = await prisma.event.create({
      data: { name: "Not yours", description: "bye", date: new Date("2026-11-01T20:00:00Z"), location: "X", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "DELETE",
      headers: { Cookie: authCookie(other) },
    });
    expect(res.status).toBe(403);
    const still = await prisma.event.findUnique({ where: { id: created.id } });
    expect(still).not.toBeNull();
  });

  test("admin can delete any event (204)", async () => {
    const owner = await makeUser();
    const admin = await makeUser("ADMIN");
    const created = await prisma.event.create({
      data: { name: "Anyone's", description: "bye", date: new Date("2026-11-01T20:00:00Z"), location: "X", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "DELETE",
      headers: { Cookie: authCookie(admin) },
    });
    expect(res.status).toBe(204);
  });

  test("returns 404 for non-existent event when authenticated", async () => {
    const user = await makeUser();
    const res = await fetch(`${baseUrl}/event/99999`, {
      method: "DELETE",
      headers: { Cookie: authCookie(user) },
    });
    expect(res.status).toBe(404);
  });
});

describe("PUT /event/:id", () => {
  test("rejects unauthenticated requests with 401", async () => {
    const owner = await makeUser();
    const created = await prisma.event.create({
      data: { name: "Original", description: "desc", date: new Date("2026-11-01T20:00:00Z"), location: "X", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated",
        description: "desc",
        date: "2026-11-02T20:00:00.000Z",
        location: "Y",
      }),
    });
    expect(res.status).toBe(401);
  });

  test("owner updates their event and returns 200 with the updated fields", async () => {
    const owner = await makeUser();
    const created = await prisma.event.create({
      data: { name: "Original", description: "desc", date: new Date("2026-11-01T20:00:00Z"), location: "X", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: authCookie(owner) },
      body: JSON.stringify({
        name: "Updated name",
        description: "Updated desc",
        date: "2026-11-02T20:00:00.000Z",
        location: "New venue",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated name");
    expect(body.description).toBe("Updated desc");
    expect(body.location).toBe("New venue");
  });

  test("contributor cannot update another user's event (403)", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const created = await prisma.event.create({
      data: { name: "Original", description: "desc", date: new Date("2026-11-01T20:00:00Z"), location: "X", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: authCookie(other) },
      body: JSON.stringify({
        name: "Hijacked",
        description: "desc",
        date: "2026-11-02T20:00:00.000Z",
        location: "X",
      }),
    });
    expect(res.status).toBe(403);
    const still = await prisma.event.findUnique({ where: { id: created.id } });
    expect(still?.name).toBe("Original");
  });

  test("admin can update any event (200)", async () => {
    const owner = await makeUser();
    const admin = await makeUser("ADMIN");
    const created = await prisma.event.create({
      data: { name: "Original", description: "desc", date: new Date("2026-11-01T20:00:00Z"), location: "X", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: authCookie(admin) },
      body: JSON.stringify({
        name: "Admin edit",
        description: "desc",
        date: "2026-11-02T20:00:00.000Z",
        location: "X",
      }),
    });
    expect(res.status).toBe(200);
  });

  test("returns 404 for non-existent event when authenticated", async () => {
    const user = await makeUser();
    const res = await fetch(`${baseUrl}/event/99999`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: authCookie(user) },
      body: JSON.stringify({
        name: "Updated",
        description: "desc",
        date: "2026-11-02T20:00:00.000Z",
        location: "X",
      }),
    });
    expect(res.status).toBe(404);
  });

  test("returns 400 for missing required fields", async () => {
    const owner = await makeUser();
    const created = await prisma.event.create({
      data: { name: "Original", description: "desc", date: new Date("2026-11-01T20:00:00Z"), location: "X", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: authCookie(owner) },
      body: JSON.stringify({ name: "", description: "ok", date: "bad", location: "" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toBeArray();
    expect(body.errors.length).toBeGreaterThan(0);
  });

  test("omitting image from the payload leaves the stored image untouched", async () => {
    const owner = await makeUser();
    const created = await prisma.event.create({
      data: { name: "Original", description: "desc", date: new Date("2026-11-01T20:00:00Z"), location: "X", image: "/uploads/original.png", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: authCookie(owner) },
      body: JSON.stringify({
        name: "Updated",
        description: "desc",
        date: "2026-11-02T20:00:00.000Z",
        location: "X",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.image).toBe("/uploads/original.png");
  });

  test("adds a link to an event that didn't have one", async () => {
    const owner = await makeUser();
    const created = await prisma.event.create({
      data: { name: "Original", description: "desc", date: new Date("2026-11-01T20:00:00Z"), location: "X", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: authCookie(owner) },
      body: JSON.stringify({
        name: "Updated",
        description: "desc",
        date: "2026-11-02T20:00:00.000Z",
        location: "X",
        link: "https://example.com/tickets",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.link).toBe("https://example.com/tickets");
  });

  test("clears an existing link when submitted empty", async () => {
    const owner = await makeUser();
    const created = await prisma.event.create({
      data: { name: "Original", description: "desc", date: new Date("2026-11-01T20:00:00Z"), location: "X", link: "https://example.com/tickets", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: authCookie(owner) },
      body: JSON.stringify({
        name: "Updated",
        description: "desc",
        date: "2026-11-02T20:00:00.000Z",
        location: "X",
        link: "",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.link).toBeNull();
  });

  test("ignores createdById in the body and keeps the original owner", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const created = await prisma.event.create({
      data: { name: "Original", description: "desc", date: new Date("2026-11-01T20:00:00Z"), location: "X", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: authCookie(owner) },
      body: JSON.stringify({
        name: "Updated",
        description: "desc",
        date: "2026-11-02T20:00:00.000Z",
        location: "X",
        createdById: other.id,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.createdById).toBe(owner.id);
  });

  test("returns 404 for non-numeric id", async () => {
    const user = await makeUser();
    const res = await fetch(`${baseUrl}/event/abc`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: authCookie(user) },
      body: JSON.stringify({
        name: "Updated",
        description: "desc",
        date: "2026-11-02T20:00:00.000Z",
        location: "X",
      }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /event/:id", () => {
  test("returns event by id (public)", async () => {
    const owner = await makeUser();
    const created = await prisma.event.create({
      data: { name: "Detail gig", description: "desc", date: new Date("2026-09-01T19:00:00Z"), location: "Nalen", createdById: owner.id },
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

  test("includes the creator's username (public)", async () => {
    const owner = await makeUser("CONTRIBUTOR", "katja");
    const created = await prisma.event.create({
      data: { name: "Detail gig", description: "desc", date: new Date("2026-09-01T19:00:00Z"), location: "Nalen", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/event/${created.id}`);
    const body = await res.json();
    expect(body.createdBy.username).toBe("katja");
  });
});

describe("GET /events", () => {
  test("returns empty array when no events (public)", async () => {
    const res = await fetch(`${baseUrl}/events`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  test("returns saved events (public)", async () => {
    const owner = await makeUser();
    await prisma.event.create({
      data: { name: "Test gig", description: "A test", date: new Date("2026-08-01T20:00:00Z"), location: "Debaser", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/events`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Test gig");
  });

  test("includes the creator's username in each event (public)", async () => {
    const owner = await makeUser("CONTRIBUTOR", "katja");
    await prisma.event.create({
      data: { name: "Test gig", description: "A test", date: new Date("2026-08-01T20:00:00Z"), location: "Debaser", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/events`);
    const body = await res.json();
    expect(body[0].createdBy.username).toBe("katja");
    expect(body[0].createdBy.email).toBeUndefined();
  });

  test("falls back to a null username when the creator hasn't set one", async () => {
    const owner = await makeUser();
    await prisma.event.create({
      data: { name: "Test gig", description: "A test", date: new Date("2026-08-01T20:00:00Z"), location: "Debaser", createdById: owner.id },
    });
    const res = await fetch(`${baseUrl}/events`);
    const body = await res.json();
    expect(body[0].createdBy.username).toBeNull();
    expect(body[0].createdBy.email).toBeUndefined();
  });
});

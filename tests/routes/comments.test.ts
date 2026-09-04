import { describe, expect, test, beforeAll, afterAll, afterEach } from "bun:test";
import { app } from "../../server/server";
import { prisma } from "../../server/db/events";
import { makeUser, authCookie } from "../helpers/auth";

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

beforeAll(() => {
  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  server.close();
  await prisma.$disconnect();
});
afterEach(async () => {
  await prisma.comment.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.invite.deleteMany();
});

async function makeEvent(ownerId: number) {
  return prisma.event.create({
    data: {
      name: "Gig",
      description: "d",
      date: new Date("2026-10-01T20:00:00Z"),
      location: "Nalen",
      createdById: ownerId,
    },
  });
}

describe("POST /event/:id/comments", () => {
  test("rejects unauthenticated with 401", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    const res = await fetch(`${baseUrl}/event/${event.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "hi" }),
    });
    expect(res.status).toBe(401);
  });

  test("creates a comment when authenticated (201)", async () => {
    const user = await makeUser("CONTRIBUTOR", "katja");
    const event = await makeEvent(user.id);
    const res = await fetch(`${baseUrl}/event/${event.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: authCookie(user) },
      body: JSON.stringify({ body: "  see you there  " }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.body).toBe("see you there"); // trimmed
    expect(body.author.username).toBe("katja");
  });

  test("returns 400 on empty body", async () => {
    const user = await makeUser();
    const event = await makeEvent(user.id);
    const res = await fetch(`${baseUrl}/event/${event.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: authCookie(user) },
      body: JSON.stringify({ body: "   " }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 404 for a non-existent event", async () => {
    const user = await makeUser();
    const res = await fetch(`${baseUrl}/event/999999/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: authCookie(user) },
      body: JSON.stringify({ body: "hi" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /event/:id/comments", () => {
  test("is public and returns comments oldest-first", async () => {
    const user = await makeUser("CONTRIBUTOR", "katja");
    const event = await makeEvent(user.id);
    await prisma.comment.create({
      data: { eventId: event.id, authorId: user.id, body: "first" },
    });
    await new Promise((r) => setTimeout(r, 5));
    await prisma.comment.create({
      data: { eventId: event.id, authorId: user.id, body: "second" },
    });

    const res = await fetch(`${baseUrl}/event/${event.id}/comments`); // no cookie
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.map((c: any) => c.body)).toEqual(["first", "second"]);
    expect(body[0].author.username).toBe("katja");
  });
});

describe("DELETE /comment/:id", () => {
  test("author can delete (204)", async () => {
    const user = await makeUser();
    const event = await makeEvent(user.id);
    const c = await prisma.comment.create({
      data: { eventId: event.id, authorId: user.id, body: "x" },
    });
    const res = await fetch(`${baseUrl}/comment/${c.id}`, {
      method: "DELETE",
      headers: { Cookie: authCookie(user) },
    });
    expect(res.status).toBe(204);
    expect(await prisma.comment.findUnique({ where: { id: c.id } })).toBeNull();
  });

  test("admin can delete another user's comment", async () => {
    const owner = await makeUser();
    const admin = await makeUser("ADMIN");
    const event = await makeEvent(owner.id);
    const c = await prisma.comment.create({
      data: { eventId: event.id, authorId: owner.id, body: "x" },
    });
    const res = await fetch(`${baseUrl}/comment/${c.id}`, {
      method: "DELETE",
      headers: { Cookie: authCookie(admin) },
    });
    expect(res.status).toBe(204);
  });

  test("a different contributor is forbidden (403)", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const event = await makeEvent(owner.id);
    const c = await prisma.comment.create({
      data: { eventId: event.id, authorId: owner.id, body: "x" },
    });
    const res = await fetch(`${baseUrl}/comment/${c.id}`, {
      method: "DELETE",
      headers: { Cookie: authCookie(other) },
    });
    expect(res.status).toBe(403);
  });

  test("404 for a non-existent comment", async () => {
    const user = await makeUser();
    const res = await fetch(`${baseUrl}/comment/999999`, {
      method: "DELETE",
      headers: { Cookie: authCookie(user) },
    });
    expect(res.status).toBe(404);
  });
});

describe("cascade", () => {
  test("deleting an event removes its comments", async () => {
    const user = await makeUser();
    const event = await makeEvent(user.id);
    await prisma.comment.create({
      data: { eventId: event.id, authorId: user.id, body: "x" },
    });
    await prisma.event.delete({ where: { id: event.id } });
    expect(await prisma.comment.count({ where: { eventId: event.id } })).toBe(0);
  });
});

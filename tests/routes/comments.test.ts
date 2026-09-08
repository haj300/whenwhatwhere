import { describe, expect, test, beforeAll, afterAll, afterEach } from "bun:test";
import { app } from "../../server/server";
import { prisma } from "../../server/db/events";
import { makeUser, authCookie } from "../helpers/auth";
import { signHandleToken } from "../../server/auth/handleSession";

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
  await prisma.commentHandle.deleteMany();
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

describe("POST /event/:id/comments — anonymous", () => {
  test("posts with a free-typed name, no session created", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    const res = await fetch(`${baseUrl}/event/${event.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "see you there", name: "Some Visitor" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.displayName).toBe("Some Visitor");
    expect(body.author).toBeNull();
    expect(body.handle).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("posts with no name at all", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    const res = await fetch(`${baseUrl}/event/${event.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "hi" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.displayName).toBeNull();
  });

  test("rejects a name that collides with a real user's username (409)", async () => {
    const owner = await makeUser("CONTRIBUTOR", "katja");
    const event = await makeEvent(owner.id);
    const res = await fetch(`${baseUrl}/event/${event.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "hi", name: "katja" }),
    });
    expect(res.status).toBe(409);
  });

  test("reserve+comment creates a CommentHandle and sets a handleToken cookie", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    const res = await fetch(`${baseUrl}/event/${event.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: "hi",
        name: "regular",
        reserve: true,
        password: "a-decent-passphrase",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.handle.username).toBe("regular");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("handleToken=");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(await prisma.commentHandle.findUnique({ where: { username: "regular" } })).not.toBeNull();
  });

  test("reserving an already-reserved name fails and posts no comment", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    await prisma.commentHandle.create({
      data: { username: "regular", passwordHash: await Bun.password.hash("whatever12345") },
    });
    const res = await fetch(`${baseUrl}/event/${event.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: "hi",
        name: "regular",
        reserve: true,
        password: "a-decent-passphrase",
      }),
    });
    expect(res.status).toBe(409);
    expect(await prisma.comment.count({ where: { eventId: event.id } })).toBe(0);
  });

  test("an existing handle session posts under that handle, ignoring a different typed name", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    const handle = await prisma.commentHandle.create({
      data: { username: "regular", passwordHash: await Bun.password.hash("whatever12345") },
    });
    const handleToken = signHandleToken({ handleId: handle.id, username: handle.username });
    const res = await fetch(`${baseUrl}/event/${event.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `handleToken=${handleToken}` },
      body: JSON.stringify({ body: "hi", name: "different name" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.handle.username).toBe("regular");
  });

  test("blocks after the per-IP anonymous rate limit is hit (429)", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    // A dedicated X-Forwarded-For value keeps this test's rate-limit bucket
    // isolated from the other anonymous-posting tests above, which all share
    // the real loopback IP (app.proxy = true, same as in production behind
    // nginx, means ctx.ip trusts this header).
    const headers = { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.50" };
    for (let i = 0; i < 20; i++) {
      const r = await fetch(`${baseUrl}/event/${event.id}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({ body: `msg ${i}` }),
      });
      expect(r.status).toBe(201);
    }
    const blocked = await fetch(`${baseUrl}/event/${event.id}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: "one too many" }),
    });
    expect(blocked.status).toBe(429);
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

describe("DELETE /comment/:id — handle-authored", () => {
  test("the owning handle session can delete its own comment", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    const handle = await prisma.commentHandle.create({
      data: { username: "regular", passwordHash: await Bun.password.hash("whatever12345") },
    });
    const c = await prisma.comment.create({ data: { eventId: event.id, body: "x", handleId: handle.id } });
    const handleToken = signHandleToken({ handleId: handle.id, username: handle.username });
    const res = await fetch(`${baseUrl}/comment/${c.id}`, {
      method: "DELETE",
      headers: { Cookie: `handleToken=${handleToken}` },
    });
    expect(res.status).toBe(204);
  });

  test("a different handle session cannot delete it (403)", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    const handle = await prisma.commentHandle.create({
      data: { username: "regular", passwordHash: await Bun.password.hash("whatever12345") },
    });
    const otherHandle = await prisma.commentHandle.create({
      data: { username: "someoneelse", passwordHash: await Bun.password.hash("whatever12345") },
    });
    const c = await prisma.comment.create({ data: { eventId: event.id, body: "x", handleId: handle.id } });
    const otherToken = signHandleToken({ handleId: otherHandle.id, username: otherHandle.username });
    const res = await fetch(`${baseUrl}/comment/${c.id}`, {
      method: "DELETE",
      headers: { Cookie: `handleToken=${otherToken}` },
    });
    expect(res.status).toBe(403);
  });

  test("a plain anonymous unclaimed-name comment cannot be deleted without a session (401)", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    const c = await prisma.comment.create({
      data: { eventId: event.id, body: "x", displayName: "someone" },
    });
    const res = await fetch(`${baseUrl}/comment/${c.id}`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("an admin can still delete any comment regardless of authorship type", async () => {
    const owner = await makeUser();
    const admin = await makeUser("ADMIN");
    const event = await makeEvent(owner.id);
    const c = await prisma.comment.create({
      data: { eventId: event.id, body: "x", displayName: "someone" },
    });
    const res = await fetch(`${baseUrl}/comment/${c.id}`, {
      method: "DELETE",
      headers: { Cookie: authCookie(admin) },
    });
    expect(res.status).toBe(204);
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

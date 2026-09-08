import { describe, expect, test, beforeAll, afterAll, afterEach } from "bun:test";
import { app } from "../../server/server";
import { prisma } from "../../server/db/events";
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
  await prisma.commentHandle.deleteMany();
});

async function makeHandle(username: string, password: string) {
  return prisma.commentHandle.create({
    data: { username, passwordHash: await Bun.password.hash(password) },
  });
}

describe("POST /comment-handles/login", () => {
  test("valid credentials set a handleToken cookie and return 204", async () => {
    await makeHandle("regular", "a-decent-passphrase");
    const res = await fetch(`${baseUrl}/comment-handles/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "regular", password: "a-decent-passphrase" }),
    });
    expect(res.status).toBe(204);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("handleToken=");
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  test("wrong password returns a generic 401", async () => {
    await makeHandle("regular", "a-decent-passphrase");
    const res = await fetch(`${baseUrl}/comment-handles/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "regular", password: "wrongpassword" }),
    });
    expect(res.status).toBe(401);
  });

  test("unknown username returns the same generic 401", async () => {
    const res = await fetch(`${baseUrl}/comment-handles/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nobody", password: "whateverpass" }),
    });
    expect(res.status).toBe(401);
  });

  test("blocks with 429 after too many failed attempts", async () => {
    await makeHandle("regular2", "a-decent-passphrase");
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`${baseUrl}/comment-handles/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "regular2", password: "wrongpassword" }),
      });
      expect(r.status).toBe(401);
    }
    const blocked = await fetch(`${baseUrl}/comment-handles/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "regular2", password: "wrongpassword" }),
    });
    expect(blocked.status).toBe(429);
  });
});

describe("GET /comment-handles/me", () => {
  test("returns 401 without a cookie", async () => {
    const res = await fetch(`${baseUrl}/comment-handles/me`);
    expect(res.status).toBe(401);
  });

  test("returns the handle's id and username with a valid cookie", async () => {
    const handleToken = signHandleToken({ handleId: 1, username: "regular" });
    const res = await fetch(`${baseUrl}/comment-handles/me`, {
      headers: { Cookie: `handleToken=${handleToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.handleId).toBe(1);
    expect(body.username).toBe("regular");
  });
});

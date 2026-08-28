import { describe, expect, test, beforeAll, afterAll, afterEach } from "bun:test";
import type { Role } from "@prisma/client";
import { app } from "../../server/server";
import { prisma } from "../../server/db/events";
import { makeUser, authCookie } from "../helpers/auth";
import { generateToken, hashToken } from "../../server/auth/tokens";

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

async function makeInvite(
  email: string,
  role: Role = "CONTRIBUTOR",
  expiresInMs = 60 * 60 * 1000,
): Promise<string> {
  const rawToken = generateToken();
  await prisma.invite.create({
    data: {
      email,
      role,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + expiresInMs),
    },
  });
  return rawToken;
}

function postJson(path: string, body: unknown, cookie?: string) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /auth/setup", () => {
  test("claims a valid invite: creates the user, deletes the invite, sets a cookie, 201", async () => {
    const token = await makeInvite("new@test.local", "ADMIN");
    const res = await postJson("/auth/setup", {
      inviteToken: token,
      password: "a-decent-passphrase",
      username: "newuser",
    });
    expect(res.status).toBe(201);

    const responseBody = await res.json();
    expect(responseBody.email).toBe("new@test.local");
    expect(responseBody.role).toBe("ADMIN");
    expect(responseBody.username).toBe("newuser");

    const user = await prisma.user.findUnique({ where: { email: "new@test.local" } });
    expect(user).not.toBeNull();
    expect(user?.role).toBe("ADMIN");
    expect(user?.username).toBe("newuser");

    expect(await prisma.invite.findFirst({ where: { email: "new@test.local" } })).toBeNull();

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("token=");
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  test("rejects a password shorter than 12 chars with 400", async () => {
    const token = await makeInvite("new@test.local");
    const res = await postJson("/auth/setup", { inviteToken: token, password: "short1" });
    expect(res.status).toBe(400);
    // no account should be created on a rejected setup
    expect(await prisma.user.findUnique({ where: { email: "new@test.local" } })).toBeNull();
  });

  test("rejects a common password with 400", async () => {
    const token = await makeInvite("new@test.local");
    const res = await postJson("/auth/setup", { inviteToken: token, password: "password1234" });
    expect(res.status).toBe(400);
  });

  test("rejects an expired invite with 400", async () => {
    const token = await makeInvite("old@test.local", "CONTRIBUTOR", -1000); // already expired
    const res = await postJson("/auth/setup", {
      inviteToken: token,
      password: "a-decent-passphrase",
      username: "olduser",
    });
    expect(res.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { email: "old@test.local" } })).toBeNull();
  });

  test("rejects an unknown token with 400", async () => {
    const res = await postJson("/auth/setup", {
      inviteToken: generateToken(), // never stored
      password: "a-decent-passphrase",
      username: "someuser",
    });
    expect(res.status).toBe(400);
  });

  test("rejects setup when a user with that email already exists (400)", async () => {
    const existing = await makeUser();
    const token = await makeInvite(existing.email);
    const res = await postJson("/auth/setup", {
      inviteToken: token,
      password: "a-decent-passphrase",
      username: "dupeemailuser",
    });
    expect(res.status).toBe(400);
  });

  test("rejects a username shorter than 3 characters with 400", async () => {
    const token = await makeInvite("new@test.local");
    const res = await postJson("/auth/setup", {
      inviteToken: token,
      password: "a-decent-passphrase",
      username: "ab",
    });
    expect(res.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { email: "new@test.local" } })).toBeNull();
  });

  test("rejects a username with disallowed characters with 400", async () => {
    const token = await makeInvite("new@test.local");
    const res = await postJson("/auth/setup", {
      inviteToken: token,
      password: "a-decent-passphrase",
      username: "katja@home",
    });
    expect(res.status).toBe(400);
  });

  test("rejects a username that's already taken with 409", async () => {
    await makeUser("CONTRIBUTOR", "katja");
    const token = await makeInvite("new@test.local");
    const res = await postJson("/auth/setup", {
      inviteToken: token,
      password: "a-decent-passphrase",
      username: "katja",
    });
    expect(res.status).toBe(409);
    expect(await prisma.user.findUnique({ where: { email: "new@test.local" } })).toBeNull();
  });
});

describe("POST /auth/login", () => {
  test("valid credentials set an httpOnly cookie and return 204", async () => {
    const user = await makeUser();
    const res = await postJson("/auth/login", { email: user.email, password: "password123" });
    expect(res.status).toBe(204);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("token=");
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  test("wrong password returns a generic 401", async () => {
    const user = await makeUser();
    const res = await postJson("/auth/login", { email: user.email, password: "wrongpassword" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid email or password");
  });

  test("unknown email returns the same generic 401", async () => {
    const res = await postJson("/auth/login", {
      email: "nobody@test.local",
      password: "whateverpass",
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid email or password");
  });

  test("blocks with 429 after too many failed attempts", async () => {
    const user = await makeUser();
    for (let i = 0; i < 5; i++) {
      const r = await postJson("/auth/login", { email: user.email, password: "wrongpassword" });
      expect(r.status).toBe(401);
    }
    const blocked = await postJson("/auth/login", { email: user.email, password: "wrongpassword" });
    expect(blocked.status).toBe(429);
  });
});

describe("GET /auth/me", () => {
  test("returns 401 without a cookie", async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    expect(res.status).toBe(401);
  });

  test("returns the current user's id and role with a valid cookie", async () => {
    const user = await makeUser("ADMIN");
    const res = await fetch(`${baseUrl}/auth/me`, { headers: { Cookie: authCookie(user) } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(user.id);
    expect(body.role).toBe("ADMIN");
    expect(body.username).toBeNull();
  });

  test("includes the username when the user has set one", async () => {
    const user = await makeUser("CONTRIBUTOR", "katja");
    const res = await fetch(`${baseUrl}/auth/me`, { headers: { Cookie: authCookie(user) } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toBe("katja");
  });
});

describe("POST /auth/logout", () => {
  test("clears the cookie and returns 204", async () => {
    const res = await fetch(`${baseUrl}/auth/logout`, { method: "POST" });
    expect(res.status).toBe(204);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("token=");
  });
});
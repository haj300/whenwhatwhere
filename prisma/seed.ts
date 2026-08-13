// Creates one local dev/demo login. Not run automatically —
// invoked manually via `bun run db:seed`.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EMAIL = "demo@whenwhatwhere.local";
const PASSWORD = "demo-password-123";

async function main() {
  // Refuse to run against production: this creates an account with a
  // publicly-known password, so it must never touch a real database.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a demo account in production");
  }

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`Seed user already exists: ${EMAIL}`);
    return;
  }

  const passwordHash = await Bun.password.hash(PASSWORD);
  await prisma.user.create({
    data: { email: EMAIL, passwordHash, role: "CONTRIBUTOR" },
  });

  console.log("Seed user created:");
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
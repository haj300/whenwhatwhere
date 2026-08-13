// Creates an Invite for a new user and prints the setup link
// Usage: bun run prisma/create-invite.ts <email> [role]
import type { Role } from "@prisma/client";
import { prisma } from "../server/db/events";
import { getUserByEmail } from "../server/db/users";
import {
  getInviteByEmail,
  createInvite,
  deleteInvite,
} from "../server/db/invites";
import { generateToken, hashToken } from "../server/auth/tokens";

const VALID_ROLES: Role[] = ["CONTRIBUTOR", "ADMIN"];
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days 

const BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

async function main() {
  const [email, roleArg] = process.argv.slice(2);
  if (!email) {
    console.error("Usage: bun run prisma/create-invite.ts <email> [role]");
    process.exitCode = 1;
    return;
  }

  const role = (roleArg?.toUpperCase() ?? "CONTRIBUTOR") as Role;
  if (!VALID_ROLES.includes(role)) {
    console.error(
      `Invalid role "${roleArg}". Must be one of: ${VALID_ROLES.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    console.error(`A user with email ${email} already exists.`);
    process.exitCode = 1;
    return;
  }

  const existingInvite = await getInviteByEmail(email);
  if (existingInvite) {
    console.log(`Replacing existing pending invite for ${email}.`);
    await deleteInvite(existingInvite.id);
  }

  const rawToken = generateToken();
  await createInvite({
    email,
    role,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + EXPIRY_MS),
  });

  const expiryDays = EXPIRY_MS / (24 * 60 * 60 * 1000);
  console.log(`Invite created for ${email} (role: ${role}), valid ${expiryDays} days.`);
  console.log(`  ${BASE_URL}/pages/setup.html#token=${rawToken}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

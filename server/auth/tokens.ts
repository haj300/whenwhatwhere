import crypto from "crypto";

export function generateToken(): string {
  // generate a random 32-byte token and return it as a hex string
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  // hash the token using SHA256 and return it as a hex string
  return crypto.createHash("sha256").update(token).digest("hex");
}

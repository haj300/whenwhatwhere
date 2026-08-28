const USERNAME_RE = /^[a-zA-Z0-9_. -]{3,20}$/;

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!USERNAME_RE.test(trimmed)) {
    return "Username must be 3-20 characters: letters, numbers, spaces, . _ or - only";
  }
  return null;
}

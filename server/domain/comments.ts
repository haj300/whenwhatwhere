import { validateUsername } from "./username";
import { validatePassword } from "./password";

type NewComment = {
  body: string;
  name: string | null;
  reserve: boolean;
  password: string | null;
};

type ValidationResult =
  | { ok: true; comment: NewComment }
  | { ok: false; errors: string[] };

export function validateNewComment(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["request body must be a JSON object"] };
  }
  const i = input as Record<string, unknown>;
  const body = typeof i.body === "string" ? i.body.trim() : "";
  const rawName = typeof i.name === "string" ? i.name.trim() : "";
  const reserve = i.reserve === true;
  const password = typeof i.password === "string" ? i.password : "";

  const errors: string[] = [];
  if (!body) errors.push("body is required");
  else if (body.length > 1000) errors.push("body must be 1000 characters or fewer");

  if (reserve) {
    const usernameError = rawName ? validateUsername(rawName) : "name is required to reserve it";
    if (usernameError) errors.push(usernameError);
    const passwordError = password ? validatePassword(password) : "password is required to reserve a name";
    if (passwordError) errors.push(passwordError);
  } else if (rawName.length > 20) {
    errors.push("name must be 20 characters or fewer");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    comment: {
      body,
      name: rawName || null,
      reserve,
      password: reserve ? password : null,
    },
  };
}

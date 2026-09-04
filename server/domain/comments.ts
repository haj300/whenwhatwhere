type NewComment = { body: string };

type ValidationResult =
  | { ok: true; comment: NewComment }
  | { ok: false; errors: string[] };

export function validateNewComment(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["request body must be a JSON object"] };
  }
  const i = input as Record<string, unknown>;
  const body = typeof i.body === "string" ? i.body.trim() : "";

  const errors: string[] = [];
  if (!body) errors.push("body is required");
  else if (body.length > 1000) errors.push("body must be 1000 characters or fewer");

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, comment: { body } };
}

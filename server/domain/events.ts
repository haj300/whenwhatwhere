import type { NewEvent } from "./types";

type ValidationResult =
  | { ok: true; event: NewEvent }
  | { ok: false; errors: string[] };

export function validateNewEvent(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["request body must be a JSON object"] };
  }
  const errors: string[] = [];
  const i = input as Record<string, unknown>;

  const name = typeof i.name === "string" ? i.name.trim() : "";
  const description = typeof i.description === "string" ? i.description.trim() : "";
  const date = typeof i.date === "string" ? i.date.trim() : "";
  const location = typeof i.location === "string" ? i.location.trim() : "";
  const link = typeof i.link === "string" && i.link.trim() ? i.link.trim() : undefined;
  const image = typeof i.image === "string" && i.image.trim() ? i.image.trim() : undefined;

  if (!name) errors.push("name is required");
  else if (name.length > 255) errors.push("name must be 255 characters or fewer");

  if (!description) errors.push("description is required");
  else if (description.length > 1255) errors.push("description must be 1255 characters or fewer");

  if (!date) errors.push("date is required");
  else if (isNaN(new Date(date).getTime())) errors.push("date is invalid");

  if (!location) errors.push("location is required");
  else if (location.length > 255) errors.push("location must be 255 characters or fewer");

  if (link !== undefined) {
    try {
      const url = new URL(link);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    } catch {
      errors.push("link must be a valid http(s) URL");
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, event: { name, description, date, location, link, image } };
}

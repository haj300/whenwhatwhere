import { describe, expect, test } from "bun:test";
import { validateNewEvent } from "../../server/domain/events";

describe("validateNewEvent", () => {
  const valid = {
    name: "Test gig",
    description: "A great night",
    date: "2026-08-01T20:00:00.000Z",
    location: "Debaser",
  };

  test("accepts a valid event", () => {
    const result = validateNewEvent(valid);
    expect(result.ok).toBe(true);
  });

  test("rejects missing name", () => {
    const result = validateNewEvent({ ...valid, name: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("name is required");
  });

  test("rejects missing description", () => {
    const result = validateNewEvent({ ...valid, description: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("description is required");
  });

  test("rejects missing location", () => {
    const result = validateNewEvent({ ...valid, location: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("location is required");
  });

  test("rejects invalid date", () => {
    const result = validateNewEvent({ ...valid, date: "not-a-date" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("date is invalid");
  });

  test("rejects invalid link", () => {
    const result = validateNewEvent({ ...valid, link: "not-a-url" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("link must be a valid http(s) URL");
  });

  test("accepts valid link", () => {
    const result = validateNewEvent({ ...valid, link: "https://example.com/tickets" });
    expect(result.ok).toBe(true);
  });

  test("rejects name over 255 chars", () => {
    const result = validateNewEvent({ ...valid, name: "a".repeat(256) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("name must be 255 characters or fewer");
  });

  test("rejects description over 1255 chars", () => {
    const result = validateNewEvent({ ...valid, description: "a".repeat(1256) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("description must be 1255 characters or fewer");
  });

  test("collects multiple errors", () => {
    const result = validateNewEvent({ ...valid, name: "", location: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(2);
  });
});

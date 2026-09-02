import { describe, expect, test } from "bun:test";
import { usernameColorClass, COLOR_CLASSES } from "../../public/js/usernameColor.js";

describe("usernameColorClass", () => {
  test("returns one of the 16 known classes", () => {
    expect(COLOR_CLASSES).toHaveLength(16);
    expect(COLOR_CLASSES).toContain(usernameColorClass("katja"));
  });

  test("is deterministic for the same username", () => {
    expect(usernameColorClass("katja")).toBe(usernameColorClass("katja"));
    expect(usernameColorClass("haj300")).toBe(usernameColorClass("haj300"));
  });

  test("gives different-looking usernames a fair chance at different colors", () => {
    const classes = new Set(
      ["alice", "bob", "carol", "dave", "erin", "frank"].map(usernameColorClass),
    );
    expect(classes.size).toBeGreaterThan(1);
  });

  test("handles the 'unknown' fallback string like any other username", () => {
    expect(COLOR_CLASSES).toContain(usernameColorClass("unknown"));
  });

  test("keeps a username's color stable across releases", () => {
    expect(usernameColorClass("katja")).toBe("uc-red");
  });
});

import { describe, expect, test } from "bun:test";
import { canDeleteEvent } from "../../server/domain/permissions";

describe("delete event permissions", () => {
  test("user with role ADMIN can delete event", () => {
    const role = "ADMIN";
    const userId = 1; // ID of the user attempting to delete the event
    expect(canDeleteEvent({ userId, role }, { createdById: 999 })).toBe(true);
  });

  test("user with role CONTRIBUTOR can only delete their own event", () => {
    const role = "CONTRIBUTOR";
    const userId = 1; // ID of the user attempting to delete the event
    const createdById = 1; // ID of the user who created the event
    expect(canDeleteEvent({ userId, role }, { createdById })).toBe(true);
  });

  test("user with role CONTRIBUTOR cannot delete someone else's event", () => {
    const role = "CONTRIBUTOR";
    const userId = 1; // ID of the user attempting to delete the event
    const createdById = 2; // ID of the user who created the event
    expect(canDeleteEvent({ userId, role }, { createdById })).toBe(false);
  });
});

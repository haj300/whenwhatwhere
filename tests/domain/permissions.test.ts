import { describe, expect, test } from "bun:test";
import { canDeleteEvent, canEditEvent, canDeleteHandleComment } from "../../server/domain/permissions";

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

describe("edit event permissions", () => {
  test("user with role ADMIN can edit any event", () => {
    const role = "ADMIN";
    const userId = 1; // ID of the user attempting to edit the event
    expect(canEditEvent({ userId, role }, { createdById: 999 })).toBe(true);
  });

  test("user with role CONTRIBUTOR can edit their own event", () => {
    const role = "CONTRIBUTOR";
    const userId = 1; // ID of the user attempting to edit the event
    const createdById = 1; // ID of the user who created the event
    expect(canEditEvent({ userId, role }, { createdById })).toBe(true);
  });

  test("user with role CONTRIBUTOR cannot edit someone else's event", () => {
    const role = "CONTRIBUTOR";
    const userId = 1; // ID of the user attempting to edit the event
    const createdById = 2; // ID of the user who created the event
    expect(canEditEvent({ userId, role }, { createdById })).toBe(false);
  });
});

describe("canDeleteHandleComment", () => {
  test("the same handle can delete its own comment", () => {
    expect(canDeleteHandleComment(7, { handleId: 7 })).toBe(true);
  });

  test("a different handle cannot delete it", () => {
    expect(canDeleteHandleComment(8, { handleId: 7 })).toBe(false);
  });

  test("a plain anonymous comment (no handle) cannot be deleted this way", () => {
    expect(canDeleteHandleComment(7, { handleId: null })).toBe(false);
  });
});

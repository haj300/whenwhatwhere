# whenwhatwhere — notes & backlog

Small tasks, improvements, and decisions to revisit. Add things here as they come up; remove them when done.

---

## Improvements to revisit

- **Frontend type checking** — `api.js` and other public JS files could get `@ts-check` + JSDoc annotations for VS Code type safety without a build step. Requires adding `"checkJs": true` to `tsconfig.json`. Deferred: keeping frontend as plain JS for now.
- **Invite system is disconnected end-to-end** — `POST /auth/setup` works and expects a valid invite token, but nothing creates `Invite` rows and there's no email-sending anywhere in the project. Real signup is currently unusable. For local dev/demo, `prisma/seed.ts` bypasses this entirely (creates a `User` directly, no invite/token/email involved) — that script is a dev shortcut, not a preview of the real flow. Needs: an invite-creation path (script or admin route) + a way to deliver the raw token (email service, or manually share the link for now).

---

## Decisions log

- **No build step on the frontend** — serving plain JS via `koa-static`. Avoids Vite/esbuild complexity. Revisit if frontend grows significantly.
- **GCS image uploads deferred** — billing account closed. Code left in `server.ts`. Images stored as `null` in DB.
- **Layered backend refactor done** — `server/domain/`, `server/db/`, `server/routes/` pattern. See `docs/superpowers/specs/2026-06-10-layered-refactor-design.md`.
- **`NewEvent.date` is `Date`, not `string`** — conversion happens once in `validateNewEvent`. Enforced by the type system.
- **Auth session model: single JWT (~7d), not refresh tokens (yet)** — *Decided:* start with one moderate-lifetime JWT in an httpOnly cookie; log in again when it expires. *Why:* simple, and httpOnly already makes token theft hard for a small trusted contributor group. *Rejected (for now):* access + refresh token pair — more secure and a pattern worth learning, but adds real complexity. *Plan:* design the schema so refresh tokens can be added later as a deliberate second learning exercise without a rewrite.

---

## Session 2026-06-25

### Worked on
PR review of the layered refactor branch (`katjalindeberg/whe-36-refactor-to-typescript`), followed by fixing all critical and important issues found.

### Completed
- **Validator non-object guard** — `validateNewEvent` now returns 400 (not 500) for `null`, `[]`, or primitive bodies
- **`api.js` error body** — `request()` now reads the response body before throwing; server validation errors reach the caller
- **Frontend error feedback** — `postEvent.js` aborts on image failure and shows error; shows create-event error; `getEvent.js` shows error in `#name` on fetch failure or missing id
- **`addEvent.html`** — added `<p id="formError" hidden>` for form error display
- **Teardown order** — integration tests now close server before disconnecting Prisma
- **Optional-field test** — POST 201 test now includes `link` and `image` fields and asserts they're returned
- **`uploadImageHandler` null guard** — missing file returns 400 instead of 500
- **`NewEvent.date` type** — changed from `string` to `Date`; conversion moved into `validateNewEvent`; `createEvent` no longer calls `new Date()`
- 20 tests passing

### Next session priorities
- New branch (user intent at end of session)
- Remaining suggestions from PR review if wanted: impossible date validation (`"2026-02-30"`), `image` URL format check, `GCLOUD_STORAGE_BUCKET` startup check

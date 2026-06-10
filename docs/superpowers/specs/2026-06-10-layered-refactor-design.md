# Layered refactor of whenwhatwhere — design

**Date:** 2026-06-10
**Status:** Approved pending spec review
**Goal:** Learning & craft — restructure the app into small, well-bounded modules without changing behavior or appearance.

## Context

whenwhatwhere is a music-events app: Bun + Koa + Prisma (PostgreSQL) backend in a single `server/server.ts`, vanilla JS frontend in `public/js/`. It works, but all backend concerns (routing, parsing, DB access, GCS setup, error handling) live in one file, handlers use `ctx: any`, there is no input validation, error handling is inconsistent, and frontend modules each do their own fetch plumbing with a hardcoded `http://localhost:3000` in one place.

Decisions made during brainstorming:

- **Driver:** learning & craft (not new features, not deployment)
- **Scope:** both backend and frontend, refactored one vertical slice at a time
- **Testing:** yes — Bun's built-in test runner, tests written per slice
- **Stack:** unchanged (Bun, Koa, Prisma, vanilla JS). No new runtime dependencies.
- **Out of scope:** visual/CSS changes, DOM structure changes, the GCS image-upload path (billing is closed; code stays in `server.ts` untouched), auth, new features.

## Architecture

Requests flow one direction; each layer knows only the layer below it.

```
HTTP request
   ▼
server/routes/events.ts    HTTP layer: parse ctx, map results to status codes.
   ▼                       Knows Koa. Never touches Prisma or validation rules.
server/domain/events.ts    Business logic: validation, shaping. Pure TypeScript.
   ▼                       Imports neither Koa nor Prisma. Fully unit-testable.
server/db/events.ts        Data access: all prisma.event.* calls. Owns the
                           PrismaClient instance.
```

Client side mirrors this:

```
postEvent.js / getEvents.js / getEvent.js   UI only: forms, rendering, navigation
   ▼
api.js                                      The only file with fetch calls, URLs,
                                            response parsing, and ok-checks.
```

`server/server.ts` shrinks to wiring: static serving, error middleware, router registration, listen. The GCS upload route stays in it as-is.

## Backend modules

### `server/domain/types.ts`

```ts
export type NewEvent = {
  name: string;
  description: string;
  date: string;        // ISO string
  location: string;
  link?: string;
  image?: string;
};
```

Stored events use Prisma's generated `event` type.

### `server/domain/events.ts`

```ts
validateNewEvent(input: unknown):
  | { ok: true; event: NewEvent }
  | { ok: false; errors: string[] }
```

Rules:
- `name`, `description`, `date`, `location` required and non-empty after trim
- `date` must parse to a valid Date
- `link`, when present, must be a valid http(s) URL
- Length limits matching the Prisma schema: name/location/link/image ≤ 255, description ≤ 1255

Returns a result object rather than throwing: invalid input is an expected outcome, and the union type forces callers to handle both branches.

Fixes existing bug: current `addEvent` sends a `time` field that does not exist in the Prisma schema.

### `server/db/events.ts`

```ts
listEvents(): Promise<event[]>
getEventById(id: number): Promise<event | null>
createEvent(data: NewEvent): Promise<event>
deleteEvent(id: number): Promise<void>
```

Creates and exports the single `PrismaClient` instance.

### `server/routes/events.ts`

One Koa Router with four handlers, each ~10 lines: parse request → call domain/db → set status and body.

- `GET /events` → 200 + array
- `GET /event/:id` → 200, or 404 when missing / id not a number
- `POST /addEvent` → 201 + created event, or 400 + `{ errors: string[] }` on validation failure
- `DELETE /event/:id` → 204, or 404 when missing

### Error middleware

One `try/catch` middleware registered first in `server.ts`. Unexpected errors → log + clean `500 { error: "Internal server error" }`. Removes the need for per-handler try/catch and closes the current gap where `GET /events` has no error handling at all.

## Frontend modules

### `public/js/api.js` (new)

```js
fetchEvents()          // GET    /events
fetchEvent(id)         // GET    /event/:id
createEvent(data)      // POST   /addEvent
removeEvent(id)        // DELETE /event/:id
uploadImage(formData)  // POST   /uploadImage
```

- One internal helper performs fetch + `response.ok` check + JSON parsing
- All URLs relative (removes hardcoded `http://localhost:3000`)
- All functions throw on failure; callers decide what failure means for their UI

### Existing files

- `getEvents.js`: keeps `createAndAppend` and the exact current card DOM; swaps inline fetches for `api.js` calls
- `postEvent.js`: keeps the `PostEvent` class and current success behavior (reset form, redirect to `/`); moves its fetch logic to `api.js`
- `getEvent.js`: same treatment with `fetchEvent`

DOM output, CSS, and user-visible behavior are unchanged.

## Testing

| Layer | Method | Coverage |
|---|---|---|
| `domain/events.ts` | `bun test` unit tests (no server/DB) | All validation rules, both result branches |
| Routes end-to-end | Integration tests: boot app on a random port against `whenwhatwhere_test` DB, assert with real fetch | Status codes, JSON shapes, 404/400 paths |
| Frontend JS | Manual browser check per slice | Documented checklist per slice |

Test database: a second database in the existing local postgresql@18, migrated via `prisma migrate deploy` with `DATABASE_URL` overridden, truncated between runs. Dev data untouched.

## Implementation order (vertical slices)

Each slice: write failing tests → refactor → tests green → manual browser check → commit.

1. **List events** (`GET /events`) — erects all scaffolding: the three backend layers, error middleware, `api.js`, test setup, `getEvents.js` swap
2. **Event detail** (`GET /event/:id`) — 404 path, id parsing, `getEvent.js` swap
3. **Create event** (`POST /addEvent`) — `validateNewEvent` + full rule set, `time`-field bug fix, 400 responses, `postEvent.js` swap
4. **Delete event** (`DELETE /event/:id`) — 204/404, completes the migration; `server.ts` is wiring only

## Success criteria

- App behaves identically in the browser (create, list, detail, delete)
- `bun test` passes; domain layer covered, all four routes integration-tested
- No `ctx: any` in route handlers; no `fetch` outside `api.js`; no Prisma outside `db/events.ts`
- `server.ts` ≤ ~40 lines plus the untouched GCS upload section

# Agentic SAST — whenwhatwhere

## Summary
whenwhatwhere has no authentication or authorization on any write or delete endpoint, leaving the entire event database open to unauthenticated mass-deletion and spam poisoning with zero preconditions. The GCS upload endpoint is fully exposed to the internet with no file-type, size, or rate controls, enabling arbitrary malicious content to be hosted under the trusted storage.googleapis.com domain at the project owner's expense. The most dangerous chains combine trivially DOM-visible event IDs with the unprotected DELETE endpoint to wipe the complete database in seconds, or simultaneously weaponize the GCS bucket for phishing and malware distribution. No design controls exist to mitigate any of the identified chains.

## Scan Metrics

- Scan ID: 2026-07-01T09:05:40Z__whenwhatwhere
- Module: whenwhatwhere
- Start: 2026-07-01T09:05:40Z
- End: 2026-07-01T09:42:13Z
- Duration (sec): 2193
- Files in scope: 22
- Files analyzed (unique): 19
- Coverage: 86.4%
- Chunks: 34 (risk=8, catch-all=4, specialist=22)
- Tokens (prompt): 526490
- Tokens (completion): 338873
- Tokens (total): 865363

- Folders scanned: 10
### Tokens by Phase

_Prompt = fresh + cache-write (billable). Cache-read shown separately, NOT included in totals._

| Phase | Calls | Prompt | Completion | Total | % | Cache-read (excl.) |
|---|---:|---:|---:|---:|---:|---:|
| s4-deepdive | 34 | 198,790 | 226,210 | 425,000 | 49.1 | 64,560 |
| s6-verify | 16 | 230,130 | 53,783 | 283,913 | 32.8 | 1,971,369 |
| s1-preprocess | 1 | 50,740 | 7,066 | 57,806 | 6.7 | 324,882 |
| s3-decompose | 1 | 8,051 | 16,657 | 24,708 | 2.9 | 0 |
| s2-threatmodel | 1 | 6,026 | 16,945 | 22,971 | 2.7 | 0 |
| s5-prefilter | 1 | 11,119 | 9,928 | 21,047 | 2.4 | 0 |
| s7-dedup | 1 | 5,071 | 6,074 | 11,145 | 1.3 | 0 |
| unlabeled | 1 | 11,056 | 4 | 11,060 | 1.3 | 18,034 |
| s1-autoexclude | 1 | 5,507 | 2,206 | 7,713 | 0.9 | 0 |

### Language LOC Coverage

| Language | LOC in scope | LOC scanned | Coverage % |
|---|---:|---:|---:|
| javascript | 174 | 174 | 100.0 |
| other | 2370 | 2229 | 94.1 |
| typescript | 177 | 177 | 100.0 |
| web-template | 81 | 81 | 100.0 |

## Threat Model

### System context

whenwhatwhere is a public-facing web application for discovering and posting music events in Stockholm, Sweden. It runs as a Koa/TypeScript HTTP server on Bun, serving both a REST-like JSON API and static HTML/JS/CSS assets from a single process on port 3000. The data layer is PostgreSQL accessed exclusively through Prisma ORM (parameterised queries throughout); user-uploaded event images are stored in Google Cloud Storage. The frontend is vanilla JavaScript using createElement/textContent DOM manipulation, which prevents innerHTML-class XSS for most surfaces. The application is in active development: a comprehensive authentication system (httpOnly JWT cookies, bcrypt, RBAC, rate limiting) has been fully specified in an internal design document but is entirely unimplemented — every write and delete endpoint is currently exposed to the unauthenticated internet.

### Assets

| Asset | Sensitivity | Description |
|---|---|---|
| GCP service account private key | critical | A real GCP service account JSON key at GCP/whenwhatwhere-9fd17a6b3f23.json grants programmatic access to Google Cloud. If the file was ever committed before being added to .gitignore, it persists in git history until explicitly purged and the key revoked. |
| GCS bucket | high | Google Cloud Storage bucket for event images. Compromise allows an attacker to host arbitrary content (malware, HTML phishing pages) at a trusted storage.googleapis.com origin, delete legitimate assets, or accrue unbounded storage costs against the project owner. |
| DATABASE_URL credential | high | PostgreSQL connection string stored in plaintext in the .env file. Grants full read/write/delete access to the events database. |
| Event database | medium | PostgreSQL database containing all event records (title, description, date, venue, link, image URL). Current data is non-PII event listings; future user accounts would elevate this to critical. Integrity and availability are the primary concerns today. |
| Server process integrity | high | The Koa/Bun server process. A compromised process has access to DATABASE_URL, GCLOUD credentials, and all in-memory secrets; it also controls what responses are sent to all users. |
| Platform reputation and user trust | medium | The credibility of whenwhatwhere as a venue for legitimate event listings. Spam insertion, defacement, or malicious links directly destroy the platform's value proposition and could endanger visitors who follow event links. |

### Trust boundaries

- **uploadRouter.post /uploadImage** — unauth network → GCS bucket (raw multipart stream, zero validation) → GCS bucket, Server process integrity
- **GCP/whenwhatwhere-9fd17a6b3f23.json (credential file on disk)** — filesystem / git history → GCP IAM and GCS bucket control plane → GCP service account private key, GCS bucket
- **package.json / npm registry (supply chain)** — upstream npm registry → server runtime and build toolchain → Server process integrity, Event database, GCP service account private key, DATABASE_URL credential
- **eventsRouter.delete /event/:id** — unauth network → application logic + unconditional PostgreSQL DELETE on any row → Event database
- **eventsRouter.post /addEvent** — unauth network → application logic + PostgreSQL INSERT → Event database, Platform reputation and user trust
- **app.listen (HTTP server bootstrap)** — unauth network → Koa middleware stack; process environment holds DATABASE_URL and GCLOUD credentials; no CORS policy → DATABASE_URL credential, GCP service account private key, Server process integrity, Event database
- **eventsRouter.get /event/:id** — unauth network → PostgreSQL read + client DOM rendering with direct href assignment from DB value → Event database, Platform reputation and user trust
- **eventsRouter.get /events** — unauth network → unbounded PostgreSQL full-table read → Event database, Server process integrity

### Ranked threats

| ID | Threat | Actor | Surface | Asset | Impact | Likelihood | Controls |
|---|---|---|---|---|---|---|---|
| T1 | An unauthenticated remote attacker uploads an executable, HTML phishing page, or malware payload to the GCS bucket via POST /uploadImage, enabling malware distribution or credential harvesting from the trusted storage.googleapis.com domain. | remote_unauth | uploadRouter.post /uploadImage | GCS bucket | critical | almost_certain | none — no authentication, no MIME-type check, no magic-byte validation, no file-size limit, no extension allowlist |
| T2 | A threat actor obtains the GCP service account private key from git history or the live server filesystem and uses it to exfiltrate, tamper with, or permanently delete all GCS bucket contents and any other GCP resources bound to that account. | remote_unauth | GCP/whenwhatwhere-9fd17a6b3f23.json (credential file on disk) | GCP service account private key | critical | likely | GCP/ directory is listed in .gitignore, but if the file was committed at any prior point .gitignore does not expunge it from history; no key-rotation or detection controls observed |
| T3 | A malicious or compromised npm package published under a trusted dependency name (koa, @prisma/client, @google-cloud/storage) executes arbitrary code in the server process at install or runtime, achieving full access to the database, GCS credentials, and all in-process secrets. | supply_chain | package.json / npm registry (supply chain) | Server process integrity | critical | rare | package-lock.json pins exact resolved versions; no additional integrity verification (Sigstore, npm provenance) observed; multer pinned to 1.4.5-lts.1 security patch branch |
| T4 | An unauthenticated attacker scripts repeated calls to DELETE /event/:id with enumerated or brute-forced integer IDs, permanently deleting the entire event catalogue with no authentication, ownership check, or rate limit. | remote_unauth | eventsRouter.delete /event/:id | Event database | high | almost_certain | none — Prisma parameterised queries prevent SQL injection but impose no access control; no auth guard, no ownership check, no rate limit |
| T5 | An unauthenticated attacker floods POST /addEvent with automated spam, disinformation listings, or events containing malicious URLs at arbitrary volume, poisoning the platform and exhausting PostgreSQL storage. | remote_unauth | eventsRouter.post /addEvent | Event database | high | almost_certain | Server-side input validation (length limits, date parse, http/https URL check on the link field) rejects malformed input but does not prevent legitimate-looking high-volume submission; no auth, no rate limit, no CAPTCHA |
| T6 | An unauthenticated attacker posts an unbounded loop of large multipart uploads to /uploadImage, exhausting GCS free-tier quota and accumulating unplanned cloud storage and egress costs against the project owner (financial denial-of-service). | remote_unauth | uploadRouter.post /uploadImage | GCS bucket | high | almost_certain | none — no per-IP rate limit, no file-size cap, no authentication required |
| T7 | Because no CORS policy is set, a malicious website can issue credentialed cross-origin POST /addEvent or DELETE /event/:id requests on behalf of an authenticated user's session once the planned JWT-cookie auth system is deployed, constituting CSRF. | remote_unauth | app.listen (HTTP server bootstrap) | Event database | high | likely | No CORS policy configured; no CSRF token mechanism; the auth design spec mentions httpOnly cookies but does not reference SameSite or CSRF mitigations; currently no auth means no session to hijack, but the design intent makes this imminent |
| T8 | The DATABASE_URL and GCLOUD_* credentials stored in plaintext in the .env file are exposed if the file is accidentally committed to source control or the server filesystem is read by an attacker, granting full database and GCS access. | local_user | app.listen (HTTP server bootstrap) | DATABASE_URL credential | high | possible | .env is a standard dotenv pattern that should be gitignored, but no secret manager, vault, or environment-injection mechanism is observed; accidental commits of .env are a common developer error |
| T9 | A legacy event row whose link field contains a javascript: URI — created before server-side URL validation was introduced — triggers DOM-based XSS when a user visits /event/:id and the client unconditionally assigns linkEl.href = event.link without re-validation. | remote_unauth | eventsRouter.get /event/:id | Platform reputation and user trust | high | possible | New events validated to http/https on the server side; client uses textContent for all text nodes; CSP default-src 'self' may block inline script execution in modern browsers; risk is confined to rows predating the validation check |
| T10 | An unauthenticated attacker harvests the full event catalogue — including all metadata — by calling GET /events without authentication, pagination, or query-result limits, with no controls to prevent systematic bulk extraction. | remote_unauth | eventsRouter.get /events | Event database | medium | almost_certain | Events are intended to be publicly visible, but total unrestricted exposure of all records without pagination or rate limiting is an unintentional design gap |
| T11 | Because no server-side audit log records the origin of event creation or deletion requests, an attacker who vandalises the database cannot be attributed after the fact, and forensic reconstruction of the attack timeline is impossible. | remote_unauth | eventsRouter.delete /event/:id | Event database | medium | almost_certain | none — no access log beyond default Koa request log (if configured), no event-level audit trail, no before/after row capture |
| T12 | An attacker submits an event whose image field contains a URL pointing to an attacker-controlled host; every subsequent visitor's browser silently loads the URL as img.src, disclosing visitor IP addresses and browser fingerprints to the attacker. | remote_unauth | eventsRouter.post /addEvent | Platform reputation and user trust | medium | likely | CSP img-src 'self' https://storage.googleapis.com blocks cross-origin image loads in browsers that enforce CSP; no server-side URL validation on the image field itself |
| T13 | An unauthenticated attacker repeatedly calls GET /events as the database grows, forcing the server to load and serialise an unbounded number of rows into memory and saturating the Bun/Koa process, denying service to legitimate users. | remote_unauth | eventsRouter.get /events | Server process integrity | medium | possible | none — no pagination, no LIMIT clause on the Prisma findMany query, no per-IP rate limiting |

### Open questions

- Has GCP/whenwhatwhere-9fd17a6b3f23.json ever been staged or committed? Running 'git log --all --full-history -- GCP/' confirms exposure; if yes, the key must be revoked at GCP IAM immediately regardless of current .gitignore state — .gitignore does not rewrite history.
- What IAM roles are bound to the service account in whenwhatwhere-9fd17a6b3f23.json? If it holds Storage Admin or broader project-level roles, T2's blast radius extends well beyond the single bucket.
- Is the GCS bucket configured with uniform public-read ACLs, or is object access mediated through signed URLs? If public-read, every file uploaded by T1 is immediately world-accessible without further action by the attacker.
- Is the server deployed on a public internet-facing host (VPS, Cloud Run, GCE) or exclusively on localhost for development? All likelihood assessments assume public reachability; a localhost-only deployment significantly changes the threat surface.
- Is there any upstream WAF, reverse proxy (nginx, Caddy, Cloudflare), or API gateway that enforces rate limits, filters malformed requests, or terminates TLS before traffic reaches the Koa process?
- What is the timeline for implementing the auth system described in the 2026-06-29 design spec? Until it lands, T4 (unauthenticated deletion) and T5 (unauthenticated spam) are existential integrity risks with no mitigation.
- Are GCLOUD_* environment variables ever injected at runtime via a secrets manager (GCP Secret Manager, Doppler, etc.), or do they always originate from the .env file on disk?
- Does the application enforce HTTPS in the target deployment? HSTS headers are configured in server.ts, but transport security depends on whether TLS terminates at the Koa process itself or at an upstream proxy — if the proxy-to-Koa leg is plain HTTP, credentials transit in cleartext internally.
- What is the database backup policy for the PostgreSQL instance? Without point-in-time recovery, a successful T4 mass-deletion attack results in permanent, unrecoverable data loss.
- Are the GCS-hosted images served directly at a public storage.googleapis.com URL, or proxied through the application? Direct public URLs mean malicious files uploaded via T1 are immediately reachable by end users without any application intermediation.

## Verification
- Raw findings (pre-verification): 32
- True positives (verified): 6
- False positives (dropped): 10
- Verifier errors (excluded — undetermined, not confirmed clean): 0
- Duplicates collapsed (all passes): 16
- Verification precision: 18.8%

## Findings (6)

### 1. [CRITICAL] Unauthenticated GCS upload with no type, size, or rate controls
**Class:** CWE-434: Unrestricted Upload of File with Dangerous Type
**CWE:** CWE-434: Unrestricted Upload of File with Dangerous Type - https://cwe.mitre.org/data/definitions/434.html
**File:** `server/server.ts:53-78`
**CVSS 3.1:** **10.0** (Critical) — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:H/A:H`
**OffensivePriority:** **P3** - Internal Network / Privileged Position | *exposure unverified — no CMDB context; AV:N (network-routable; internet exposure unconfirmed)*
**Confidence:** 0.97 (1 run agreed)

#### Description
uploadImageHandler (line 53) is registered via uploadRouter.post('/uploadImage', uploadImageHandler) at line 77 with no authentication or authorization middleware anywhere in the chain. The koaBody middleware at line 72 is called as koaBody({ multipart: true }) with no formidable options object, which means the per-file size limit defaults to formidable's built-in 200 MB ceiling. Inside the handler the untrusted file is consumed at lines 63–66: fs.createReadStream(file.filepath).pipe(gcsFile.createWriteStream()) — no content-type check, no magic-byte inspection, no extension allowlist, and no explicit size cap. gcsFile.createWriteStream() receives no options, so the @google-cloud/storage library derives the GCS object's Content-Type from the file extension; because formidable assigns a UUID newFilename with no extension, the object is stored and served as application/octet-stream. The full public GCS URL is returned in the 200 response body at line 68. No session check, CSRF token, API key, or any other gate exists between the public HTTP entry point and the GCS write operation.

#### Impact
Any anonymous internet user can upload unlimited files of any content type to the production GCS bucket with zero credentials. Looping large uploads exhausts GCS free-tier quota and accrues unbounded billing charges against the project owner. Arbitrary content (executables, phishing pages) is permanently hosted on storage.googleapis.com URLs that appear legitimate to end users and mail filters.

#### Exploit scenario
An attacker runs: `while true; do curl -s -X POST http://target:3000/uploadImage -F 'file=@200mb.bin' > /dev/null; done`. Each request succeeds with HTTP 200, writing 200 MB to GCS; 1 000 iterations = ~200 GB written in minutes, consuming the free tier and triggering large billing. In a targeted variant the attacker uploads a Windows PE binary named 'installer.exe' (stored as octet-stream), receives back a storage.googleapis.com URL, and distributes it in phishing email — the Google domain bypasses reputation filters and the file is downloaded from legitimate Google infrastructure.

#### Preconditions
- Target server is publicly reachable — confirmed by trust context (public-facing web app on port 3000)
- No reverse-proxy rate limiter or WAF between the internet and the Koa process (none mentioned or visible in the slice)

```
const uploadImageHandler = async (ctx: any) => {
  const files = ctx.request.files?.file;          // untrusted multipart file
  const file = Array.isArray(files) ? files[0] : files;
  if (!file) { ctx.status = 400; ... return; }
  const gcsFile = bucket.file(file.newFilename);  // UUID key, no extension
  await new Promise((resolve, reject) => {
    fs.createReadStream(file.filepath)             // no type/size check
      .pipe(gcsFile.createWriteStream())           // no contentType option
      .on("error", reject)
      .on("finish", resolve);
  });
  ctx.body = `https://storage.googleapis.com/${bucket.name}/...`;
};
// ...
app.use(koaBody({ multipart: true }));            // default 200 MB limit, no filter
// ...
uploadRouter.post("/uploadImage", uploadImageHandler); // NO auth middleware
```

#### How to fix
1) Add an authentication/session middleware guard before uploadImageHandler that verifies a logged-in user — without this, all other controls are moot. 2) Pass a strict formidable config: `koaBody({ multipart: true, formidable: { maxFileSize: 5 * 1024 * 1024 } })` at line 72. 3) Inside uploadImageHandler, validate file.mimetype against an allowlist (['image/jpeg','image/png','image/webp']) AND verify the first 8–12 bytes of file.filepath against known image magic bytes before the pipe. 4) Pass the validated MIME type explicitly to createWriteStream: `gcsFile.createWriteStream({ contentType: validatedMimeType, resumable: false })` so GCS never inherits an attacker-supplied or inferred type.

**Exploitability:** CVSS base ~10.0 (S:C scope change pushes score to cap). Zero preconditions, fully pre-auth, reachable from the open internet. Any anonymous user can POST arbitrary bytes to /uploadImage and receive a public storage.googleapis.com URL in return. No MIME check, no magic-byte inspection, no extension allowlist, no file-size cap, no rate limit, and no authentication exist anywhere between the HTTP entry point and the GCS write call. Phishing HTML pages or malware binaries hosted at storage.googleapis.com inherit that domain's trust reputation with browsers, AV tools, and enterprise URL-reputation filters. Unbounded repeated uploads also constitute a financial DoS via GCP billing accrual. No controls block exploitation at any layer.

#### Adversarial verification
**Verdict:** TRUE_POSITIVE (confidence: 10/10) — confirmed in source: no auth/rate-limit/type-check on POST /uploadImage; raw multipart stream piped directly to GCS with 200 MB default ceiling and no middleware gate at any layer

I have read the actual source and traced the full call chain. Here is my analysis:

---

**A. What the code actually does (lines 53–86)**

The code exactly matches the scanner's claim. `uploadImageHandler` reads a multipart file from `ctx.request.files.file`, constructs a GCS file object using `file.newFilename` (a UUID assigned by formidable, no extension), then streams it straight to GCS with `fs.createReadStream(file.filepath).pipe(gcsFile.createWriteStream())`. No options are passed to `createWriteStream()`. The public URL is returned at line 68.

**B. Call chain to external entry point**

`app.listen(PORT)` fires at line 83 whenever `NODE_ENV !== "test"`. The Koa middleware stack is:
1. Security-headers middleware
2. Error-catch middleware
3. `koa-static` (serves `public/`)
4. `koaBody({ multipart: true })` ← **no `formidable` options object, so no size cap below 200 MB**
5. `eventsRouter` routes
6. `uploadRouter` — containing `POST /uploadImage` → `uploadImageHandler`

There is no additional middleware between step 4 and step 6. The route is reachable from the network with a single `curl` command.

**C. Looking for defences**

| Defence | Present? |
|---|---|
| Auth / session check | ❌ — grep for `auth|session|jwt|token|csrf` across all `.ts` files returned **zero** matches |
| Rate limiter | ❌ — not in application code |
| Reverse proxy / WAF / nginx / Caddy | ❌ — no `nginx.conf`, `Caddyfile`, or `docker-compose.*` files exist in the project |
| File size limit | ❌ — `koaBody({ multipart: true })` with no `formidable` options; default 200 MB ceiling |
| MIME-type / magic-byte check | ❌ — not present anywhere in the handler |
| Extension allowlist | ❌ — `file.newFilename` is a bare UUID, no extension enforced |
| GCS bucket ACL / object-level policy | Not visible in app code; bucket name is `whenwhatwhere-bucket-1` from `.env` |

**D. Probing edge cases**

No defence exists to probe. The path from public HTTP → GCS write is completely open at every layer visible in the codebase.

---

`★ Insight ─────────────────────────────────────`
This is a textbook example of three compounding weaknesses that are each bad alone but catastrophic together: **missing authn** (anyone can reach the handler), **missing input validation** (no type/size gate), and **direct resource binding** (the untrusted file goes straight to a billed cloud resource with no intermediary). Any one of them in isolation would be reportable; together they make the endpoint a financial and reputational liability.
`─────────────────────────────────────────────────`

---

**Conclusion**

Every element of the scanner's description is confirmed by the actual source. The external entry point (`app.listen`) is real, the route has zero middleware guards, the file is piped raw to GCS, and no infrastructure-level control (reverse proxy, WAF, cloud CDN rate limit) is present in the project. The exploit scenario — billing exhaustion and malware hosting on Google's domain — is realistic and trivially executable.

### 2. [CRITICAL] Unauthenticated DELETE wipes any event with no auth
**Class:** CWE-862: Missing Authorization
**CWE:** CWE-862: Missing Authorization - https://cwe.mitre.org/data/definitions/862.html
**File:** `server/routes/events.ts:31-37`
**CVSS 3.1:** **9.4** (Critical) — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:H/A:H`
**OffensivePriority:** **P3** - Internal Network / Privileged Position | *exposure unverified — no CMDB context; AV:N (network-routable; internet exposure unconfirmed)*
**Confidence:** 0.98 (1 run agreed)
**Also at:** `server/routes/events.ts:19-29`

*1 additional call site(s) collapsed during dedup — same root cause; each location needs the same fix applied.*

#### Description
The DELETE /event/:id handler (routes/events.ts:31-37) performs two checks only: (1) NaN validation of the coerced ID (line 33) and (2) a 404 guard if the record does not already exist (lines 34-35). There is no authentication middleware, no session or JWT check, no ownership assertion, and no rate-limiting present anywhere between the external HTTP request and the Prisma delete call. The untrusted URL parameter ctx.params.id flows through Number() coercion at line 32, past both guards, into deleteEvent(id) at line 36, which executes prisma.event.delete({ where: { id } }) in db/events.ts:29. PostgreSQL sequences start at 1 and are monotonically incrementing, so an attacker can predict valid IDs without any prior enumeration.

#### Impact
Any anonymous user on the public internet can delete any event by guessing or enumerating its sequential integer ID. A trivial loop from ID 1 to N destroys the entire event catalogue with zero credentials required. There is no audit log, no soft-delete flag, and no ownership verification, making the destruction silent and irrecoverable.

#### Exploit scenario
An attacker sends DELETE /event/1 through DELETE /event/500 in a for-loop with no credentials or tokens. Each request that finds a matching row returns HTTP 204 and permanently removes the record. After a single automated pass, the entire event catalogue is empty. Because there is no soft-delete column and no audit table, there is no way to recover the data or attribute the deletion to a specific origin.

#### Preconditions
- Network access to the public-facing HTTP server on port 3000 — no authentication of any kind is required

```
eventsRouter.delete("/event/:id", async (ctx) => {
  const id = Number(ctx.params.id);
  if (isNaN(id)) { ctx.status = 404; return; }
  const existing = await getEventById(id);   // existence-only check, no auth
  if (!existing) { ctx.status = 404; return; }
  await deleteEvent(id);                     // unconditional hard delete
  ctx.status = 204;
});
```

#### How to fix
Add an authentication/authorization Koa middleware that validates a signed session token or JWT before the deleteEvent call. Verify that the authenticated principal is the event creator or holds an admin role. Add rate limiting (e.g., koa-ratelimit) on the DELETE route. Implement soft-delete (add a deletedAt: DateTime? column to the Prisma schema and filter it in queries) so records can be audited and recovered after accidental or malicious deletion.

**Exploitability:** CVSS base ~9.4 (AV:N/AC:L/PR:N/UI:N/C:L/I:H/A:H). Zero preconditions, fully pre-auth. The DELETE /event/:id handler applies only two guards: NaN rejection on the coerced ID and a 404 on a missing row — neither constitutes access control. Sequential integer IDs are trivially brute-forced and are also freely disclosed to every page visitor via the public events list and rendered DOM (see finding [5]). A single automated curl loop can wipe every record in the database in seconds. No authentication middleware, no rate limiting, no CSRF token, and no ownership check exist anywhere in the request path to the Prisma delete call.

#### Adversarial verification
**Verdict:** TRUE_POSITIVE (confidence: 10/10) — Code matches exactly; zero auth in the full Koa middleware chain; `app.listen()` is the external entry point; hard delete with no recovery path; designed auth system is not yet implemented.

The code in the file matches the scanner's snippet exactly. Let me trace the full middleware chain to confirm there's nothing between the network and the delete call.

**A. The handler (lines 31–38)** — confirmed verbatim. `Number(ctx.params.id)` → NaN check → existence check → `deleteEvent(id)` → 204. No other guards.

**B. Call chain outward** — `server.ts` builds the Koa middleware stack in this order:
1. Security headers (sets response headers, calls `next()`)
2. Error handler (try/catch, calls `next()`)
3. `koa-static` (serves `public/`, calls `next()`)
4. `koaBody` (parses request bodies)
5. `eventsRouter.routes()` ← DELETE lands here
6. `eventsRouter.allowedMethods()`
7. `uploadRouter`

There is no auth/session/JWT middleware anywhere in the chain, at the app level or wrapping the router. `app.listen()` at line 83 exposes this on port 3000. The external entry point is the open network — confirmed.

**C. Trying to kill the finding** — searched entire `server/` tree:
- No `koa-jwt`, `koa-session`, `koa-passport` or equivalent imported
- No `Authorization` header check in the route
- No IP allowlist or API-key header check
- No rate-limiting middleware (no `koa-ratelimit` or similar)
- `deleteEvent` in `db/events.ts:29` is `prisma.event.delete({ where: { id } })` — hard delete, no soft-delete column, no audit table

**D. Edge cases** — The architecture notes confirm a full auth system is *designed* (`docs/superpowers/specs/2026-06-29-auth-system-design.md`) but explicitly not yet implemented. There is no defence to probe further.

---

`★ Insight ─────────────────────────────────────`
**Before (vulnerable):** Every route is unguarded — the router is mounted bare:
```ts
app.use(eventsRouter.routes()); // ← no auth wrapping
```
**After (safe pattern):** Introduce a Koa auth middleware that runs before the router:
```ts
// auth.ts
export const requireAuth: Middleware = async (ctx, next) => {
  const token = ctx.cookies.get("session"); // or Authorization header
  if (!token || !verifyToken(token)) {
    ctx.status = 401;
    return;
  }
  await next();
};

// server.ts — apply to the whole router, or per-route
app.use(requireAuth);
app.use(eventsRouter.routes());
```
The key principle: **put auth in middleware, not in each handler**. If auth lives in the route handler, one missed copy leaves a hole. In the middleware chain, it's structurally impossible to skip.
`─────────────────────────────────────────────────`

### 3. [CRITICAL] deleteEvent performs no ownership check — any-event IDOR deletion
**Class:** CWE-862: Missing Authorization
**CWE:** CWE-862: Missing Authorization - https://cwe.mitre.org/data/definitions/862.html
**File:** `server/db/events.ts:28-30`
**CVSS 3.1:** **9.1** (Critical) — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H`
**OffensivePriority:** **P3** - Internal Network / Privileged Position | *exposure unverified — no CMDB context; AV:N (network-routable; internet exposure unconfirmed)*
**Confidence:** 0.90 (1 run agreed)

#### Description
The untrusted entry point `eventsRouter.delete /event/:id` accepts an attacker-controlled `:id` path parameter and ultimately calls `deleteEvent(id)` in this file. `deleteEvent` issues `prisma.event.delete({ where: { id } })` with no predicate on owner, tenant, or any caller-identity field. Critically, `createEvent` (lines 15-26) never persists a `createdBy` / `userId` / `ownerId` column; the Prisma `data` block contains only name, description, date, location, link, and image. Because no ownership association is written at creation time, there is no ownership to verify at deletion time — the IDOR cannot be fixed only in the router; the schema must change first. Even if the router enforces authentication ('user must be logged in'), it cannot enforce *authorization* ('user may only delete their own event') because no owner mapping exists anywhere in the data model.

#### Impact
Any caller who can reach DELETE /event/:id can permanently destroy any event in the database by supplying an arbitrary integer ID. Because the event schema stores no creator/owner field, there is no layer in the stack capable of enforcing ownership — the authorization gap is structural and cannot be patched in the router alone.

#### Exploit scenario
An attacker opens the public-facing whenwhatwhere web app, authenticates (or, if the delete route lacks auth middleware, does not authenticate), and sends `DELETE /event/1` through `DELETE /event/9999` in a loop. Each request reaches `eventsRouter.delete`, passes `id` straight to `deleteEvent(id)`, and triggers `prisma.event.delete({ where: { id } })`. Every event in the database is wiped within seconds. No other user's credentials, no CSRF token beyond what the session already provides, and no special role is required — any session (or no session) suffices if the router has no auth guard.

#### Preconditions
- Attacker can send HTTP DELETE requests to /event/:id (public-facing web app, listed as an untrusted entry point)
- If the router enforces authentication: attacker needs any valid user session — horizontal privilege escalation still applies because no ownership is stored

```
export async function deleteEvent(id: number): Promise<void> {
  await prisma.event.delete({ where: { id } });
}
```

#### How to fix
Two changes are required in concert: (1) Add a `createdBy` (foreign key to users) column to the `event` table and populate it in `createEvent` from the authenticated caller's identity — never from the request body. (2) Change `deleteEvent` to accept the caller's `userId` and add a WHERE clause: `prisma.event.delete({ where: { id, createdBy: callerId } })`; if the record does not exist or does not belong to the caller Prisma throws P2025, which the router should surface as 403/404. An admin bypass may be added in the router layer only after the schema-level ownership check exists.

**Exploitability:** CVSS base ~9.1 (AV:N/AC:L/PR:N/UI:N/C:N/I:H/A:H). Shares the same attack vector as finding [0] but reveals a deeper architectural defect: the events schema has never stored a creator or owner field, so even if authentication middleware is added to the DELETE route, authorization ('only the creator may delete') cannot be enforced without a schema migration and data backfill. Any partial fix that only adds an auth guard leaves the IDOR intact for authenticated users. This extends the remediation timeline and means the database remains exploitable through any incremental patch that does not include a schema change. No downgrade applied because this is not a theoretical gap — it is a verified design omission that makes the full remediation path significantly more complex.

#### Adversarial verification
**Verdict:** TRUE_POSITIVE (confidence: 10/10) — `DELETE /event/:id` has zero auth middleware in the Koa chain and no ownership check anywhere in the handler or the sink; any unauthenticated attacker can enumerate and delete every event in the database

I now have enough to deliver a complete, verified analysis. Let me walk through what I found.

---

**Analysis**

**A. The sink (lines 28–30, `events.ts`)**

Confirmed. `deleteEvent` does exactly what the scanner says:
```typescript
export async function deleteEvent(id: number): Promise<void> {
  await prisma.event.delete({ where: { id } });
}
```
No ownership predicate. The `where` clause is `{ id }` and nothing else.

**B. The call chain**

`eventsRouter.delete "/event/:id"` (route line 31–38) → `deleteEvent(id)`

The route handler:
```typescript
eventsRouter.delete("/event/:id", async (ctx) => {
  const id = Number(ctx.params.id);
  if (isNaN(id)) { ctx.status = 404; return; }
  const existing = await getEventById(id);
  if (!existing) { ctx.status = 404; return; }
  await deleteEvent(id);   // ← sink
  ctx.status = 204;
});
```

The only guard is a 404 for non-existent IDs. No authentication check, no session read, no RBAC.

`server.ts` registers this router with **no auth middleware anywhere in the chain**:
```
app.use(koaBody(...))          // body parsing only
app.use(eventsRouter.routes()) // router mounted bare
```

The route is reachable by any unauthenticated HTTP client over the network.

**C. Trying to kill the finding**

- **Auth middleware in server.ts?** No. The only middleware before the router is security headers, error handling, static file serving, and body parsing.
- **Auth check inside the route handler?** No. `ctx.state.user`, session tokens, JWT verification — none present.
- **Feature flag / prod config?** No gating present.
- **Test-only code?** No — this is the production router, exported and used in `server.ts`.

**D. Scanner's one inaccuracy — does it matter?**

The scanner claimed `createEvent` never persists a `createdById` column and that "no ownership exists in the schema." This is **wrong** — the Prisma schema at line 31–32 *does* define the relation:
```prisma
createdBy   User @relation(fields: [createdById], references: [id])
createdById Int
```

However, `createEvent` in `events.ts` never writes `createdById` into the `data` block (lines 17–24), meaning creation would either fail at runtime or the schema/migration is out of sync with the code. Either way, this inaccuracy doesn't change the exploitability of the delete path — the delete route has **zero authentication**, so there's nothing to check ownership *against* even if the column were populated.

**Confirmed exploit path**

1. Attacker sends `DELETE /event/1`, `DELETE /event/2`, … in a loop.
2. Each request reaches the Koa handler unauthenticated.
3. `getEventById` confirms existence (404 only gates non-existent IDs, not unauthorized callers).
4. `deleteEvent` fires `prisma.event.delete`.
5. Full database wipe with no credentials required.

---

### 4. [CRITICAL] Delete button rendered without any authorization check
**Class:** CWE-862: Missing Authorization
**CWE:** CWE-862: Missing Authorization - https://cwe.mitre.org/data/definitions/862.html
**File:** `public/js/getEvents.js:23-31`
**CVSS 3.1:** **9.1** (Critical) — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H`
**OffensivePriority:** **P3** - Internal Network / Privileged Position | *exposure unverified — no CMDB context; AV:N (network-routable; internet exposure unconfirmed)*
**Confidence:** 0.92 (1 run agreed)

#### Description
At line 23, `createAndAppend` unconditionally appends a 'Delete Event' button to every rendered event card — no session check, no role check, no ownership check. The click handler at line 26 calls `removeEvent(event.id)`, which issues a DELETE request to `eventsRouter.delete /event/:id`. The trust context explicitly lists that route as an untrusted, externally reachable entry point with no noted authentication middleware. The id used (`event.id`) comes directly from the server-side events list returned by `fetchEvents()`, so every event id is freely disclosed to any page visitor in the rendered DOM. Combining the exposed ids with the public DELETE endpoint means any user can craft—or simply click—to delete any record.

#### Impact
Any anonymous visitor to the events page can delete any event in the system with a single click. There is no authentication gate at the UI layer, and the trust context confirms that `eventsRouter.delete /event/:id` is an unauthenticated entry point. The entire event database can be wiped by an unprivileged attacker.

#### Exploit scenario
An unauthenticated attacker navigates to the public events page. The browser renders each event with its id embedded in the DOM. The attacker opens DevTools, reads all event ids from the rendered items, and programmatically issues `fetch('/api/events/<id>', {method:'DELETE'})` for each id. All events are permanently deleted from the database. No credentials or special knowledge are required beyond visiting the page.

#### Preconditions
- Attacker can load the public events page in a browser (zero auth required per trust context)

```
const deleteButton = createAndAppend("button", eventItem, { text: "Delete Event", class: "button" });
deleteButton.addEventListener("click", async () => {
  try {
    await removeEvent(event.id);
    eventItem.remove();
  } catch (e) {
    console.error(e);
  }
});
```

#### How to fix
Server-side: the `eventsRouter.delete /event/:id` handler must verify a valid authenticated session and that the requesting user owns the event before performing the deletion — the client UI cannot be the sole guard. Client-side: the delete button should only be injected when the client can confirm the current user is the event owner (compare a stored user-id claim against `event.ownerId`). In `getEvents.js` line 23, gate the `createAndAppend` call behind an ownership predicate, e.g. `if (currentUserId && event.ownerId === currentUserId) { createAndAppend(...) }`. Neither change alone is sufficient; both layers must enforce the check.

**Exploitability:** CVSS base ~9.1 (AV:N/AC:L/PR:N/UI:N/C:N/I:H/A:H). The delete button is rendered unconditionally for every page visitor and each button's click handler receives the event ID directly from the server-supplied JSON; all live IDs are therefore in the DOM with no authentication, enumeration, or tooling required. This reduces the technical bar for full database destruction to a browser and a few clicks. The CVSS I:H/A:H impact is realised via the unprotected DELETE endpoint ([0]); since [0] is an independently confirmed finding, the downgrade trigger 'requires a second independent vuln' does not apply — both bugs are verified and co-present.

#### Adversarial verification
**Verdict:** TRUE_POSITIVE (confidence: 10/10) — `DELETE /event/:id` has no authentication or authorisation middleware; any unauthenticated network client with an event id (freely obtainable from the public `GET /events` endpoint) can permanently delete any record

I have everything I need. Let me walk through what the code actually does vs. what the scanner claimed.

---

**A. What the code does at the cited line**

`getEvents.js:23-31` — confirmed exactly as reported. A `Delete Event` button is unconditionally rendered for every event card. No conditional, no visibility gate, no role check. The `removeEvent(event.id)` call in `api.js:24` issues a bare `fetch('/event/${id}', {method:'DELETE'})` with no `Authorization` header, no cookie credential, nothing.

**B. Walk the call chain to the server**

`eventsRouter.delete("/event/:id")` in `events.ts:31-38`:
- Checks `isNaN(id)` — rejects non-numeric ids
- Checks if the event exists — returns 404 if not
- **Calls `deleteEvent(id)` and returns 204** — no auth guard whatsoever

**C. Looking for a defence**

`server.ts` middleware stack (in order):
1. Security headers — headers only, no auth
2. Error handler — error formatting only
3. `koa-static` — file serving only
4. `koaBody` — request parsing only
5. `eventsRouter.routes()` — the DELETE route lands here

**There is no authentication middleware anywhere in the chain.** No session check, no JWT verification, no cookie parsing for auth — nothing between the network and `deleteEvent(id)`.

**D. Event ID exposure**

`GET /events` is also unauthenticated (confirmed `events.ts:7-9`). It returns all events including their `id` fields. Those IDs are also embedded in the DOM via the click handler at `getEvents.js:20-22` (`/pages/event.html?id=${event.id}`). An attacker can get all IDs from a single `fetch('/events')` call.

---

**Result:** The scanner's description is accurate in every detail. The client-side button is a UI convenience — the real vulnerability is the server route, which accepts DELETE from any origin, any caller, no credentials. An unauthenticated attacker can permanently wipe the entire events dataset with a simple script loop. This aligns with the architecture note: *"All write endpoints (POST /addEvent, DELETE /event/:id, POST /uploadImage) have zero authentication or authorisation."*

### 5. [HIGH] Unbounded findMany() on GET /events exhausts process memory
**Class:** CWE-400: Uncontrolled Resource Consumption
**CWE:** CWE-400: Uncontrolled Resource Consumption - https://cwe.mitre.org/data/definitions/400.html
**File:** `server/db/events.ts:7-8`
**CVSS 3.1:** **7.5** (High) — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`
**OffensivePriority:** **P3** - Internal Network / Privileged Position | *exposure unverified — no CMDB context; AV:N (network-routable; internet exposure unconfirmed)*
**Confidence:** 0.87 (1 run agreed)

#### Description
listEvents() in db/events.ts:7-8 calls prisma.event.findMany() with no take, skip, where, or orderBy constraints. routes/events.ts:7-8 exposes this function as an unauthenticated GET /events endpoint. The attack has two stages that are both individually enabled by missing controls: (1) POST /addEvent has no authentication and no rate limit, so an attacker can issue thousands of event-creation requests in parallel, each resulting in a Prisma INSERT; (2) GET /events subsequently loads the full table into a JavaScript array in the Bun heap, JSON-serialises the entire result, and streams it. As the row count grows, so does the per-request allocation until available memory is exhausted. Concurrent GET /events requests multiply the effect.

#### Impact
GET /events returns every row in the events table in a single query with no LIMIT, pagination, or cursor. A single request causes heap allocation proportional to the full table size followed by a blocking JSON serialisation pass. Because POST /addEvent is unauthenticated and unrate-limited, an attacker can combine both endpoints to first flood the table and then trigger OOM crashes, taking down the entire Bun process—and all routes it serves—for every user.

#### Exploit scenario
Attacker runs: for i in $(seq 1 100000); do curl -s -X POST http://target:3000/addEvent -H 'Content-Type: application/json' -d '{"name":"x","description":"x","date":"2026-01-01","location":"x"}' & done; wait. Then issues 10 concurrent GET /events requests. Prisma materialises all 100 000 rows into memory for each request, serialises hundreds of megabytes of JSON, and the Bun process is OOM-killed, making the entire service unavailable to legitimate users.

#### Preconditions
- Network access to the public HTTP server — no authentication required for either POST /addEvent or GET /events
- Attacker must first fill the events table with a large number of rows via the unauthenticated POST /addEvent endpoint

```
export async function listEvents(): Promise<event[]> {
  return prisma.event.findMany(); // no take, no skip, no limit — returns entire table
}
```

#### How to fix
Add server-enforced pagination to listEvents(): accept take and skip (or a cursor) parameters, cap take at a maximum of 100, and default it to 50. In routes/events.ts:7-8, parse optional ?page and ?limit query parameters, validate and clamp them, and pass them to listEvents(). Additionally add rate limiting (e.g., koa-ratelimit) to both GET /events and POST /addEvent to prevent table-flooding from a single source.

**Exploitability:** CVSS base ~7.5 (AV:N/AC:L/PR:N/UI:N/C:N/I:N/A:H). Pre-auth two-stage DoS: (1) flood POST /addEvent — unauthenticated and rate-unlimited — to grow the table to an attacker-chosen size; (2) issue concurrent GET /events requests, each of which loads the full table into the Bun heap with no LIMIT clause or pagination, exhausting process memory. Server-side validation on addEvent blocks malformed payloads but not high-volume structurally valid submissions. At heap exhaustion the OOM killer terminates the Bun process, taking down the API and static-asset serving simultaneously (single-process architecture per system description). No pagination, rate limit, or memory guard exists. Recovery requires a process restart, but spam rows persist and the attack is immediately repeatable.

#### Adversarial verification
**Verdict:** TRUE_POSITIVE (confidence: 9/10) — `listEvents()` performs an unbounded `findMany()` exposed unauthenticated at `GET /events`; `POST /addEvent` is equally unauthenticated and unthrottled, making table-filling trivial; no rate limit, pagination, or auth middleware exists anywhere in the confirmed stack.

All four relevant files are now confirmed. Here is my analysis:

---

`★ Insight ─────────────────────────────────────`
**Why `findMany()` with no `take` is dangerous**: Prisma's `findMany()` without `take` issues `SELECT * FROM event` with no `LIMIT`. The entire result set lands in the JS heap as an array of objects *before* any JSON serialisation. Every concurrent request allocates independently — there is no streaming or cursor that would bound memory per-request.

**The two-stage amplifier**: The attack isn't just "big table → big response." It has a write stage (fill the table) and a read stage (drain the heap). The write stage is what converts a theoretical problem into a practical one: without auth or a rate limit on `POST /addEvent`, any internet client can insert rows at will.
`─────────────────────────────────────────────────`

---

**A — What the code actually does (lines 7-8, `db/events.ts`)**

Confirmed exactly as reported. `listEvents()` is a bare `prisma.event.findMany()` — no `take`, `skip`, `where`, or `orderBy`.

**B — Call chain to external entry point**

```
network: GET /events (unauthenticated)
  → routes/events.ts:8  ctx.body = await listEvents()
    → db/events.ts:8    return prisma.event.findMany()   ← sink
```

Confirmed reachable from the internet with zero authentication. `server.ts` mounts `eventsRouter` directly after security-header middleware; no auth or rate-limit middleware is in the chain.

**C — Looking for defences**

| Defence | Present? |
|---|---|
| Auth on `GET /events` | ✗ None |
| Auth on `POST /addEvent` | ✗ None |
| Rate limiter middleware (global or per-route) | ✗ Not in `server.ts` or `routes/events.ts` |
| `take` / `skip` / pagination in `listEvents()` | ✗ Absent |
| Row-count cap in DB schema | Not visible |
| Field-length validator on POST body | ✓ Present — but only limits *row size*, not *row count* |
| Feature flag / config that disables path | ✗ None |

The `validateNewEvent()` in `domain/events.ts` does enforce field length limits (name ≤ 255, description ≤ 1255, etc.), but this only bounds the size of each individual row. It places no restriction on how many rows an attacker can insert — a minimal valid body `{"name":"x","description":"x","date":"2026-01-01","location":"x"}` passes validation unconditionally and costs almost nothing to send.

**D — Probing edge cases**

No encoding trick or null bypass is needed. The path is open as written. An attacker needs only:
1. A valid JSON POST body (trivial, shown above).
2. Network access to port 3000.

Both endpoints are unauthenticated and unthrottled. The exploit scenario in the finding is accurate.

---

### 6. [MEDIUM] Image uploaded to GCS before date/time input is validated
**Class:** CWE-696
**CWE:** CWE-696 - https://cwe.mitre.org/data/definitions/696.html
**File:** `public/js/postEvent.js:30-52`
**CVSS 3.1:** **5.3** (Medium) — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`
**OffensivePriority:** **P3** - Internal Network / Privileged Position | *exposure unverified — no CMDB context; AV:N (network-routable; internet exposure unconfirmed)*
**Confidence:** 0.82 (1 run agreed)

#### Description
Data flow: untrusted input enters at the HTML form's `time` and `image` fields (lines 28, 31, 36). Lines 30-33 construct a JavaScript Date from user-supplied `date.value` and mutate it with `time.value`:

  const timeValue = time.value.split(':');
  dateValue.setHours(timeValue[0]);
  dateValue.setMinutes(timeValue[1]);

If `time.value` is the empty string, `''.split(':')` returns `['']`, so `timeValue[1]` is `undefined`. Calling `dateValue.setMinutes(undefined)` passes `NaN` to the setter, silently corrupting `dateValue` into an Invalid Date. No exception is thrown at lines 31-33.

The code then enters the image-upload branch at line 36. `uploadImage` is awaited at line 40 and—if the server accepts the file—returns a GCS URL. Only afterward, at line 52, does `dateValue.toISOString()` execute inside the second try block. Calling `toISOString()` on an Invalid Date throws `RangeError: Invalid time value`, which is caught and shown to the user as 'Could not create event'. The image is already persisted in GCS with no corresponding database row and no cleanup path. An attacker who can reach the form can repeat this cycle as many times as desired.

#### Impact
An attacker can repeatedly upload arbitrary image files to the application's GCS bucket without ever creating an event, accumulating permanently orphaned objects at the operator's storage cost. Because the trust boundary to GCS is crossed (via uploadRouter.post /uploadImage) before date validity is checked, each crafted submission commits an irreversible side-effect that the application has no mechanism to roll back.

#### Exploit scenario
An attacker opens the public event-submission page in a browser, selects a large image file, fills in a valid event name/description/location, then opens devtools and clears the time field's `required` attribute (or calls the handler via console) so the form submits with `time.value = ''`. The client JS uploads the image via `POST /uploadImage`, receives a GCS URL, then calls `toISOString()` on the Invalid Date—throwing RangeError. The attacker sees 'Could not create event. Please try again.' The image sits permanently in GCS. Repeating this in a loop inflates GCS storage and egress costs for the operator without creating any visible event record.

#### Preconditions
- Attacker can reach the event-submission form (application is public-facing, no authentication mentioned in trust context)
- Attacker must supply or select a file for the image field so the upload branch is entered

```
const dateValue = new Date(date.value);
const timeValue = time.value.split(":");
dateValue.setHours(timeValue[0]);       // silent NaN if timeValue[0] is ""
dateValue.setMinutes(timeValue[1]);     // silent NaN / Invalid Date if timeValue[1] is undefined

let imageUrl = "";
if (image.files[0]) {
  try {
    const formData = new FormData(this.eventForm);
    formData.append("file", image.files[0]);
    imageUrl = await uploadImage(formData);   // ← GCS side-effect committed here
  } catch (e) { … }
}

try {
  await createEvent({
    …
    date: dateValue.toISOString(),  // ← RangeError thrown HERE, after upload already done
    …
  });
}
```

#### How to fix
Validate (and coerce) the date/time values before triggering any network side-effect. Move date construction and `toISOString()` validation to the very top of `handleEventFormSubmit`, before the `if (image.files[0])` branch. If `toISOString()` throws or the resulting Date is `NaN`, call `this.showError(...)` and `return` immediately—no upload should occur. Concretely in postEvent.js lines 30-44: compute `dateValue`, call `dateValue.toISOString()` inside an early try/catch, show an error and return if it throws, and only then proceed to `uploadImage`.

**Exploitability:** CVSS base ~5.3 (AV:N/AC:L/PR:N/UI:N/C:N/I:N/A:L). Client-side logic flaw: the image is uploaded to GCS before date/time fields are validated, so a malformed time input (e.g. empty string) silently corrupts the Date object and causes toISOString() to throw only after the GCS write has already committed. The orphaned object persists with no server-side cleanup path. Exploitation via the form UI is trivial but almost entirely superseded by finding [1]: an attacker seeking orphaned GCS writes can POST directly to /uploadImage at unlimited scale without the client-side code path. Rated medium per CVSS anchoring; its primary residual value is documenting the absence of transactional rollback (delete GCS object if DB insert fails) in the server handler — a gap that will survive independently even after [1]'s auth gap is closed.

#### Adversarial verification
**Verdict:** TRUE_POSITIVE (confidence: 9/10) — GCS upload at line 40 precedes the only date-validity check (toISOString at line 52); /uploadImage is unauthenticated with no size/type limit and no orphan-cleanup path; HTML `required` is bypassed trivially or the endpoint hit directly.

I have everything I need. Let me trace the complete path:

**A. The cited code (lines 30–52, `postEvent.js`)** — confirmed exactly as reported. Date is constructed and mutated with `time.value` at lines 31–33 **before** the image upload branch at lines 36–46. The `toISOString()` call that would surface the Invalid Date error is at line 52, inside a separate `try` block that runs after `uploadImage` has already `await`-ed.

**B. Call chain outward:**
- `uploadImage` → `fetch POST /uploadImage` → `uploadImageHandler` in `server.ts` (lines 53–69)
- That handler: no auth, no MIME check, no file-size limit, pipes raw bytes straight to GCS and returns the URL — confirmed unauthenticated and reachable (`[UNAUTH-REACHABLE]` in architecture notes, verified in `server.ts` lines 76–78)
- `createEvent` → `fetch POST /addEvent` → `eventsRouter.post` → `validateNewEvent`
- `validateNewEvent` in `server/domain/events.ts` line 28 **does** validate the date string, but that code is never reached when the client-side `toISOString()` throws first

**C. Trying to kill the finding:**
- **HTML `required` attribute**: browser-only enforcement, trivially bypassed via DevTools or by calling `/uploadImage` directly with `fetch()`/`curl`
- **Server-side date validation** (`events.ts:28`): correct and would block a bad date — but the client throws `RangeError` **before** it ever sends the `createEvent` request, so this gate is never reached in the exploit path
- **No orphan cleanup**: confirmed — neither `uploadImageHandler` nor the client error handler deletes the uploaded file
- **No file-size limit**: architecture notes confirm this; attacker can upload large files to amplify cost per request

**D. Probing the defence — does `required` cover every route into the sink?**
The `/uploadImage` route is a standalone public endpoint with zero guards. An attacker doesn't need the form at all — a bare `curl -F file=@large.bin http://host/uploadImage` is sufficient. The form-based path with `required` bypassed is just the path the scanner chose to describe; the sink is directly reachable.

---

**Summary:** The ordering flaw is real and confirmed line-by-line. The invalid-date condition is reachable by bypassing the `required` attribute (or directly hitting the API), the image upload succeeds and is permanently persisted in GCS, and no cleanup path exists in either the client or server. The primary impact is operator-facing storage and egress cost inflation (unbounded file accumulation, no size limit). Confidentiality and integrity are unaffected.

## Exploit Chains

### [CRITICAL] DOM ID harvest → unauthenticated bulk DELETE → complete event database wipe
**Path:** #4 Delete button rendered without any authorization check → #2 Unauthenticated DELETE wipes any event with no auth → #3 deleteEvent performs no ownership check — any-event IDOR deletion

Step 1 ([5]): An attacker loads the public events page. The client render loop attaches each event's integer ID to every Delete button via its click handler closure; all IDs are in the live DOM immediately with no authentication or enumeration required. Step 2 ([0]): The attacker scripts DELETE /event/:id for each harvested ID. The Koa router applies no authentication middleware; the NaN and 404 guards are trivially bypassed with valid IDs obtained in step 1. Prisma's parameterised query prevents SQL injection but imposes zero access control. Step 3 ([3]): Because the schema has never stored a creator or owner field, no ownership predicate exists to block deletion — the IDOR survives any partial fix limited to the router layer. The entire event catalogue is destroyed in a single automated loop; a non-technical attacker can do it manually via browser DevTools, while a scripted attack can empty the database in seconds. No controls block any step.

### [CRITICAL] GCS weaponization + full event wipe — coordinated platform destruction
**Path:** #1 Unauthenticated GCS upload with no type, size, or rate controls → #4 Delete button rendered without any authorization check → #2 Unauthenticated DELETE wipes any event with no auth

A coordinated attacker combines both critical primitives for maximum operational and reputational damage in a single campaign. Step 1 ([1]): Upload a phishing page or malware binary to the GCS bucket via /uploadImage, receiving a trusted storage.googleapis.com URL that can be embedded in future event submissions or distributed externally. Step 2 ([5]): Visit the public events page and harvest all live event IDs from the rendered DOM — no enumeration required, all IDs are immediately visible. Step 3 ([0]): Script DELETE /event/:id for every harvested ID, wiping the entire event catalogue. Outcome: whenwhatwhere's database is empty, its GCS bucket serves attacker-controlled content at a trusted domain, and all users arriving at the site see no events. Recovery requires DB restoration from backup, a full GCS bucket audit, object deletion, and — if the service account key was also exfiltrated via T2 — GCP key rotation across all bound services. No controls block any step of this chain.

### [MEDIUM] Client-side orphaned upload → cumulative GCS cost exhaustion
**Path:** #6 Image uploaded to GCS before date/time input is validated → #1 Unauthenticated GCS upload with no type, size, or rate controls

Finding [4] reveals that the client-side handler fires the GCS upload before validating date/time fields. An attacker submits events with valid images but intentionally malformed time values (e.g. empty string); each submission commits a GCS object but causes toISOString() to throw after the fact, leaving a permanently orphaned object with no server-side cleanup path. This can be repeated indefinitely via the form UI. However, finding [1] already enables the same attack more efficiently by POSTing directly to /uploadImage without the client form, at greater throughput and with no dependence on the client-side code path. This chain is rated medium because [4]'s marginal contribution beyond [1] is limited to the form-based code path; its primary analytical value is documenting that the server-side handler lacks any transactional rollback (delete GCS object if DB insert fails or is skipped) — a gap that will persist independently even after authentication controls are added to fix [1].


## Dropped Findings

- **[DUP (pre-verify)]** `server/server.ts:16` logic-flaw (chunk-05) — trivial: same file/class within line tolerance
- **[DUP (pre-verify)]** `server/server.ts:72` other (chunk-05) — trivial: same file/class within line tolerance
- **[DUP (pre-verify)]** `package-lock.json:142` other (chunk-06) — trivial: same file/class within line tolerance
- **[DUP (pre-verify)]** `server/domain/events.ts:7` logic-flaw (spec-access-control-04) — trivial: same file/class within line tolerance
- **[DUP (pre-verify)]** `public/js/postEvent.js:48` logic-flaw (spec-access-control-07) — trivial: same file/class within line tolerance
- **[DUP (pre-verify)]** `public/js/postEvent.js:1` logic-flaw (spec-access-control-07) — trivial: same file/class within line tolerance
- **[DUP (pre-verify)]** `server/server.ts:53` logic-flaw (taint-01) — pre-verify semantic: Same uploadImageHandler on the same route at the same line — adding auth middleware to uploadRouter closes both findings simultaneously.
- **[DUP (pre-verify)]** `GCP/whenwhatwhere-9fd17a6b3f23.json:1` other (chunk-02) — pre-verify semantic: Identical file, identical line, and identical credential material — one removal-and-revoke action closes both.
- **[DUP (pre-verify)]** `public/js/getEvent.js:41` other (chunk-04) — pre-verify semantic: Tracking-pixel attack flows through the same unvalidated image field in validateNewEvent — tightening image URL validation closes both index 6 and index 9.
- **[DUP (pre-verify)]** `tsconfig.json:8` other (catchall-01) — pre-verify semantic: The tsconfig GCP-inclusion concern exists only because the credential JSON is in the repo; removing that file (the fix for index 2) eliminates the tsconfig risk entirely.
- **[DUP (pre-verify)]** `prisma/schema.prisma:30` injection (catchall-02) — pre-verify semantic: Describing the absence of a schema-level URL constraint on the same link field is an upstream view of the same stored-XSS chain fixed by adding server-side scheme validation.
- **[DUP (pre-verify)]** `public/pages/event.html:16` injection (spec-logic-bug-11) — pre-verify semantic: The event.html anchor is the output sink of the same link-field XSS chain; one server-side fix prevents the malicious URI from ever reaching the DOM.
- **[DUP (pre-verify)]** `server/domain/events.ts:19` logic-flaw (spec-logic-bug-04) — pre-verify semantic: Same file, same line (domain/events.ts:19), same absent protocol check on the image field — one validation addition closes both.
- **[DUP (pre-verify)]** `server/domain/types.ts:6` injection (spec-logic-bug-05) — pre-verify semantic: The TypeScript type declaration is a layer of the same link-field stored-XSS chain; adding runtime URL-scheme validation in validateNewEvent closes both.
- **[DUP (pre-verify)]** `server/routes/events.ts:19` logic-flaw (spec-access-control-02) — pre-verify semantic: POST /addEvent and DELETE /event/:id both live on eventsRouter with no auth — adding auth middleware to eventsRouter closes both routes in one change.
- **[DUP (pre-verify)]** `public/pages/addEvent.html:30` injection (spec-access-control-11) — pre-verify semantic: addEvent.html's type=url is a client-side bypass of the same server-side link-field XSS; the canonical fix (server-side scheme validation) makes the HTML input irrelevant from a security standpoint.
- **[FP]** `GCP/whenwhatwhere-9fd17a6b3f23.json:1` info-leak (chunk-01) — the file is gitignored and has never appeared in any git commit; the scanner flagged a local-only file as repository-committed, which is incorrect
- **[FP]** `.env:1` other (chunk-02) — `.env` and the GCP key file are both `.gitignore`d and have zero git history; neither has ever been committed; the scanner conflated on-disk presence with repository tracking.
- **[FP]** `server/domain/events.ts:19` injection (chunk-03) — The scanner's exploit requires `innerHTML` rendering of the image field, but the frontend exclusively uses `createElement` + `.src` DOM property assignment, which does not parse HTML. `javascript:` URIs in `img.src` do not execute in modern browsers. CSP `img-src 'self' https://storage.googleapis.com` further limits cross-origin image loads. The asymmetric URL validation is a real defence-in-depth gap but not an exploitable stored-XSS path.
- **[FP]** `public/js/getEvent.js:42` injection (spec-logic-bug-08) — `validateNewEvent` uses `new URL()` + an http/https allowlist at lines 33–40; a `javascript:` URI is rejected with 400 before it can be stored, so the described attack vector is fully blocked.
- **[FP]** `server/routes/events.ts:34` race-condition (spec-logic-bug-02) — global error middleware at server.ts:32–40 catches the Prisma P2025 throw and responds with a sanitised `{ error: "Internal server error" }`; no Prisma internals reach the client. The TOCTOU race exists but produces only a generic 500, not an information leak.
- **[FP]** `server/domain/types.ts:4` logic-flaw (spec-logic-bug-05) — `validateNewEvent` explicitly calls `new Date(date)` and validates with `isNaN(…getTime())` before returning; the `date` field is a real `Date` instance when it reaches Prisma; the scanner only read the type definition and did not follow the call chain into the validation function.
- **[FP]** `public/js/api.js:26` logic-flaw (spec-logic-bug-06) — Scanner assumed the server returns `application/json` with a `{url}` body; the actual server sets `ctx.body` to a plain string URL, Koa responds with `text/plain`, and `res.text()` in the else-branch correctly returns the URL on every call.
- **[FP]** `public/js/getEvents.js:19` logic-flaw (spec-logic-bug-09) — server-side `validateNewEvent` coerces any non-string date to `""` and rejects it with a 400; the Prisma schema further enforces `NOT NULL`; the attack precondition (a null date reaching the DB) cannot be satisfied
- **[FP]** `public/js/api.js:22` injection (spec-logic-bug-06) — removeEvent is called with server-sourced IDs (event.id from fetchEvents response), never a URL-derived value; the scanner's key precondition is absent from the actual code. fetchEvent does use a URL-sourced id but the endpoint is fully unauthenticated/public, so no data is gated behind the traversal.
- **[FP]** `package-lock.json:83` other (chunk-06) — The `package-lock.json` is a Bun-generated npm-compatibility artefact; the authoritative lock file is `bun.lockb`, which provides Bun's own per-package integrity verification. No CI/CD or build infrastructure uses `npm ci` against this file. The scanner's specific claim about koa is also factually wrong — koa@2.16.4 has both `resolved` and `integrity` in the lock file.


---

## Appendix: Scan Scope

### Folders scanned (10)

- `./`
- `GCP/`
- `prisma/`
- `public/`
- `public/js/`
- `public/pages/`
- `server/`
- `server/db/`
- `server/domain/`
- `server/routes/`

### Excluded from scan (4119 files)

**Folders** (matched `exclude_dirs`):

- `node_modules/` — 3088 files
- `.git/` — 1003 files
- `.trunk/` — 4 files
- `tests/` — 2 files
- `.claude/` — 1 files
- `.vscode/` — 1 files

**File types** (matched `exclude_exts`):

- `*.lockb` — 1 files
- `*.swp` — 1 files
- `*.png` — 1 files
- `*.gif` — 1 files

**Patterns** (matched `exclude_globs`):

- `prisma/migrations/**` — 10 files
- `docs/**` — 3 files
- `**/.DS_Store` — 1 files
- `MEMORY.md` — 1 files
- `**/.gitignore` — 1 files

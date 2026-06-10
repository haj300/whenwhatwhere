# whenwhatwhere

A calendar to add and find music events in Stockholm, Sweden.
Users will be able to login and create their personal page, as well as adding and attending events.
The purpose is to substitue fb events.

## Core features

- Create events
- Post events
- Attend events
- Search events
- Display calendar
- User login
- User personal page

### Future features

- Forum
- Other cities in Sweden

## Tech stack

### Frontend

Javascript, HTML, CSS

### Backend

Bun, Koa, Typescript

### DB

PostgreSQL (via Prisma)

## Getting started

### Prerequisites

- [Bun](https://bun.sh) installed
- PostgreSQL running locally (e.g. via Homebrew: `brew services start postgresql`)

### 1. Install dependencies

    bun install

### 2. Configure environment

Copy the template and fill in your values:

    cp .env.template .env

- `DATABASE_URL` — your local PostgreSQL connection string
- `GCLOUD_*` — Google Cloud Storage credentials for image uploads.
  Optional: the app runs without them, but uploading images will fail.

### 3. Set up the database

Applies migrations and generates the Prisma client (required before first run):

    bunx prisma migrate dev

### 4. Start the server

    bun --hot run server/server.ts

Then open http://localhost:3000

`--hot` enables hot reload on file changes.

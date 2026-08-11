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
- [Docker](https://docs.docker.com/get-docker/) installed (runs the local Postgres — you don't need Postgres installed on your machine)

### 1. Install dependencies

    bun install

### 2. Configure environment

Copy the template:

    cp .env.template .env

- `DATABASE_URL` — already set to the Docker Postgres; works out of the box.
- `JWT_SECRET` — set this to any long random string for local dev.
- `GCLOUD_*` — Google Cloud Storage credentials for image uploads.
  Optional: the app runs without them, but uploading images will fail.

### 3. Start everything

    bun run dev

This one command:

1. starts Postgres in Docker and waits until it's ready (`docker compose up -d --wait db`),
2. applies database migrations (`bunx prisma migrate dev`),
3. starts the server with hot reload (`bun --hot`).

Then open http://localhost:3000

The database runs in the background even after you stop the server. To stop it:

    docker compose down        # stops Postgres, keeps your data
    docker compose down -v      # also deletes the data volume (fresh start)

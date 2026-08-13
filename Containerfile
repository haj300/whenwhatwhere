# Production image, built directly on the VPS:
#   podman build -t localhost/whenwhatwhere:latest -f Containerfile .
#
# Runs under rootless Podman (see app.container) — that's the isolation
# layer here, so this deliberately doesn't add a separate in-container
# non-root user; kept as simple as the rest of the stack.

FROM docker.io/oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

# Generates the Prisma client for THIS image's platform. Building on the
# VPS (rather than pushing an image built elsewhere) means this always
# matches the machine that will run it.
RUN bunx prisma generate

EXPOSE 3000

# migrate deploy (not `migrate dev`) applies existing migrations
# non-interactively — the right command for production.
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run server/server.ts"]
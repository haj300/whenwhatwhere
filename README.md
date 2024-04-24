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

### Front end

Javascript, HTML, CSS

### Backend

Bun, Koa, Typescript

### DB

Postgress

## To run:

    bun --hot run server/server.ts

## Migrate Prisma DB:

    bun primsa migrate dev

import dotenv from 'dotenv';
import {PrismaClient} from ".prisma/client";

dotenv.config();

//Db test code
const prisma = new PrismaClient();
prisma.$connect();
prisma.event.findMany().then((events) => {
  console.log(events);
});

const server = Bun.serve({
  port: 3000,
  fetch(request) {
    return new Response("Welcome to Bun!");
  },
});

console.log(`Listening on localhost:${server.port}`);

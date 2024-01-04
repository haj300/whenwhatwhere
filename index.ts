import { connect, listTables } from './db.ts';
import dotenv from 'dotenv';

dotenv.config();

//db test code
const db = connect();
var result = await listTables(db);
console.log(result);

const server = Bun.serve({
  port: 3000,
  fetch(request) {
    return new Response("Welcome to Bun!");
  },
});

console.log(`Listening on localhost:${server.port}`);

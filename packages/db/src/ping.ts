/**
 * Connectivity check: `SWARM_DATABASE_URL` must be set to the (IPv4) Session pooler URL.
 * Prints the connected user, database, and the count of public tables (should be 11).
 * Run: `npx tsx src/ping.ts` with SWARM_DATABASE_URL in the environment.
 */
import { getPool, closePool } from './index.js';

const r = await getPool().query(
  `select current_user as usr, current_database() as db,
          (select count(*)::int from information_schema.tables where table_schema = 'public') as tables`,
);
console.log('DB OK:', JSON.stringify(r.rows[0]));
await closePool();

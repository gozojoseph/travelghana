/**
 * Local development database without Docker/WSL (Windows dev machine).
 *
 * Runs a real PostgreSQL 17 server as a normal user process with a data dir
 * under node_modules/.local-postgres. This is a DEV convenience only —
 * production uses managed Postgres (docs/DECISIONS.md D9).
 *
 * Usage:
 *   node infrastructure/local-db.mjs start   # start + create DBs, then keep running
 *   node infrastructure/local-db.mjs stop
 *
 * Prefer `docker compose -f infrastructure/docker-compose.yml up -d` when
 * Docker/WSL is available.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { join } from "node:path";

const command = process.argv[2] ?? "start";
const dataDir = join(process.cwd(), "node_modules", ".local-postgres", "data");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
});

async function main() {
  if (command === "stop") {
    await pg.stop();
    console.log("Local Postgres stopped.");
    return;
  }

  const initialised = existsSync(join(dataDir, "PG_VERSION"));
  if (!initialised) {
    console.log("Initialising local Postgres cluster…");
    await pg.initialise();
  }
  await pg.start();
  console.log("Local Postgres running on :5432 (postgres/postgres)");

  for (const db of ["travelghana", "travelghana_test"]) {
    try {
      await pg.createDatabase(db);
      console.log(`Database ready: ${db}`);
    } catch {
      // already exists
    }
  }
  // Keep the process alive (dev service).
  process.on("SIGINT", async () => {
    await pg.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

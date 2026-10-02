import { execSync } from "node:child_process";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/travelghana_test";

/**
 * Runs once before all integration tests: resets the dedicated test database
 * so every run is deterministic.
 *
 * SAFETY: the suite previously reset `travelghana_test` but left the Nest app
 * reading DATABASE_URL from the root .env, so every test actually executed
 * against the DEVELOPMENT database. That produced phantom 409s on re-runs and
 * wrote test users into dev data. We now (a) point the whole vitest process at
 * the test database and (b) hard-refuse to run against anything not named
 * `*_test`, because the reset below is destructive.
 */
function assertIsolatedDatabase(url: string): void {
  let databaseName: string;
  try {
    databaseName = new URL(url).pathname.replace(/^\//, "");
  } catch {
    throw new Error(`TEST_DATABASE_URL is not a valid URL: ${url}`);
  }

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against database "${databaseName}".\n` +
        `The suite issues 'prisma db push --force-reset', which DROPS all data in the\n` +
        `target database. Point TEST_DATABASE_URL at a database whose name ends in "_test".`,
    );
  }
}

export default async function globalSetup(): Promise<void> {
  assertIsolatedDatabase(TEST_DATABASE_URL);

  // Make the app under test use the same database we just reset.
  process.env.DATABASE_URL = TEST_DATABASE_URL;

  execSync(
    "pnpm --filter @travelghana/database exec prisma db push --force-reset --skip-generate",
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    },
  );
}
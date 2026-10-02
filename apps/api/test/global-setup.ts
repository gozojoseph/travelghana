import { execSync } from "node:child_process";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/travelghana_test";

/**
 * Runs once before all integration tests: resets the dedicated test database
 * schema so every run is deterministic (real Postgres required — see
 * infrastructure/docker-compose.yml or `pnpm db:start`).
 */
export default async function globalSetup(): Promise<void> {
  execSync(
    "pnpm --filter @travelghana/database exec prisma db push --force-reset --skip-generate",
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    },
  );
}

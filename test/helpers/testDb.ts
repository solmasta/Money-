// Gives each integration test file its own isolated Postgres schema
// namespace within one shared database — the Postgres analogue of "a
// fresh SQLite file per test file" from before the Postgres migration.
// Requires a real, reachable Postgres instance (TEST_DATABASE_URL or
// DATABASE_URL) — unlike SQLite, there's no way to spin up an ephemeral
// database with zero external dependencies.

import { execSync } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

function requireBaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL (or DATABASE_URL) must point at a reachable Postgres instance to run the integration tests — see README's Testing section.",
    );
  }
  return url;
}

function withSchema(baseUrl: string, schema: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}

export interface TestDatabase {
  prisma: PrismaClient;
  teardown: () => Promise<void>;
}

/**
 * Creates a uniquely-named schema in the target Postgres database, pushes
 * the full Prisma schema into it, and returns a PrismaClient scoped to
 * just that schema plus a teardown function that drops it in one shot.
 * Call once per test file in `beforeAll`; call `teardown` in `afterAll`.
 */
export async function setupTestDatabase(): Promise<TestDatabase> {
  const baseUrl = requireBaseUrl();
  const schema = `test_${crypto.randomBytes(6).toString("hex")}`;
  const scopedUrl = withSchema(baseUrl, schema);

  execSync("npx prisma db push --skip-generate", {
    cwd: path.resolve(__dirname, "..", ".."),
    env: { ...process.env, DATABASE_URL: scopedUrl },
    stdio: "pipe",
  });

  const prisma = new PrismaClient({ datasourceUrl: scopedUrl });

  return {
    prisma,
    teardown: async () => {
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await prisma.$disconnect();
    },
  };
}

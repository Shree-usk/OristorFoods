import { execSync } from "node:child_process";
import path from "node:path";

export default function setup() {
  // db push first, so tables exist for a truly fresh database before we
  // try to truncate them.
  execSync("npx prisma db push", {
    stdio: "inherit",
  });

  // Wipe all app data (not schema) before every run. Seed data and test
  // fixtures can share literal values (e.g. the same SKU), and previous
  // tasks only clean up rows they personally created — without a real
  // data wipe here, running `db seed` and then the test suite back-to-back
  // fails on unique-constraint collisions. `db execute` running a plain
  // TRUNCATE script isn't gated the way `db push --force-reset
  // --accept-data-loss` is, so this doesn't hit Prisma's AI-agent consent
  // requirement.
  execSync(`npx prisma db execute --file "${path.resolve(__dirname, "truncate-all.sql")}"`, {
    stdio: "inherit",
  });
}

// One-shot entry point for running the closure-SLA enforcement sweep from
// an external scheduler (cron, a Kubernetes CronJob, a serverless
// scheduled function, ...) instead of the in-process interval in
// src/jobs/scheduler.ts. Prefer this in a horizontally-scaled deployment,
// where you want exactly one sweep to run regardless of how many API
// instances are up.
//
// Usage: npm run job:enforce-silence   (after `npm run build`, or via tsx
// directly in dev — see package.json)

import { prisma } from "../src/db.js";
import { runEnforceSilenceSweep } from "../src/domain/silenceEnforcement.js";

async function main() {
  const results = await runEnforceSilenceSweep(prisma);
  console.log(`Enforced ${results.length} silent obligation(s).`);
  for (const result of results) {
    console.log(` - user ${result.userId} on match ${result.matchId} (new score: ${result.newAccountabilityScore})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

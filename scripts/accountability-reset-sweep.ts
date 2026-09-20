// One-shot entry point for running the cancellation-ladder accountability
// reset sweep from an external scheduler, mirroring
// scripts/enforce-silence-sweep.ts — see that file's header for when to
// prefer this over the in-process interval in src/jobs/scheduler.ts.
//
// Usage: npm run job:accountability-reset

import { prisma } from "../src/db.js";
import { runAccountabilityResetSweep } from "../src/domain/accountabilityReset.js";

async function main() {
  const results = await runAccountabilityResetSweep(prisma);
  console.log(`Reset ${results.length} expired accountability penalty(ies).`);
  for (const result of results) {
    console.log(` - user ${result.userId} (new score: ${result.newAccountabilityScore})`);
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

import type { PrismaClient } from "@prisma/client";
import { runEnforceSilenceSweep } from "../domain/silenceEnforcement.js";
import { runAccountabilityResetSweep } from "../domain/accountabilityReset.js";

/**
 * Runs `sweep` on a fixed interval inside this process, logging a one-line
 * summary whenever it does something. Shared by every scheduled sweep in
 * this app (silence enforcement, the cancellation-ladder accountability
 * reset, ...) so each one only has to describe itself.
 *
 * If you run multiple instances of this server behind a load balancer,
 * don't start the same scheduler from every instance — you'd run redundant
 * (harmless, since every sweep here is idempotent, but wasteful) sweeps
 * from each one. Either call it from exactly one instance, or don't call
 * it at all and instead run the matching `npm run job:*` script from a
 * single external scheduler (cron, a Kubernetes CronJob, etc.) — see
 * scripts/.
 *
 * Returns a function that stops the interval, for tests/graceful shutdown.
 */
function startScheduledSweep<T>(
  label: string,
  sweep: (prisma: PrismaClient) => Promise<T[]>,
  describe: (item: T) => string,
  prisma: PrismaClient,
  intervalMinutes: number,
): () => void {
  const intervalMs = intervalMinutes * 60 * 1000;

  const tick = async () => {
    try {
      const results = await sweep(prisma);
      if (results.length > 0) {
        console.log(`[${label}] acted on ${results.length} item(s):`, results.map(describe).join(", "));
      }
    } catch (err) {
      console.error(`[${label}] sweep failed:`, err);
    }
  };

  void tick(); // run once immediately so a restart doesn't wait a full interval
  const handle = setInterval(tick, intervalMs);
  handle.unref?.(); // don't keep the process alive just for this timer

  return () => clearInterval(handle);
}

const DEFAULT_ENFORCE_SILENCE_INTERVAL_MINUTES = 15;

/** See src/domain/silenceEnforcement.ts for what this enforces. */
export function startEnforceSilenceScheduler(
  prisma: PrismaClient,
  intervalMinutes: number = DEFAULT_ENFORCE_SILENCE_INTERVAL_MINUTES,
): () => void {
  return startScheduledSweep(
    "enforce-silence",
    runEnforceSilenceSweep,
    (r) => `${r.userId}@${r.matchId}`,
    prisma,
    intervalMinutes,
  );
}

const DEFAULT_ACCOUNTABILITY_RESET_INTERVAL_MINUTES = 60;

/** See src/domain/accountabilityReset.ts for what this resets. */
export function startAccountabilityResetScheduler(
  prisma: PrismaClient,
  intervalMinutes: number = DEFAULT_ACCOUNTABILITY_RESET_INTERVAL_MINUTES,
): () => void {
  return startScheduledSweep(
    "accountability-reset",
    runAccountabilityResetSweep,
    (r) => `${r.userId} -> ${r.newAccountabilityScore}`,
    prisma,
    intervalMinutes,
  );
}

import type { PrismaClient } from "@prisma/client";
import { runEnforceSilenceSweep } from "../domain/silenceEnforcement.js";

const DEFAULT_INTERVAL_MINUTES = 15;

/**
 * Runs the silence-enforcement sweep on a fixed interval inside this
 * process. Convenient for a single-instance deployment (or local dev) —
 * `npm run dev` alone is enough to see enforcement happen automatically.
 *
 * If you run multiple instances of this server behind a load balancer,
 * don't call this from every instance — you'd run redundant (harmless,
 * since the sweep is idempotent, but wasteful) sweeps from each one.
 * Either call it from exactly one instance, or don't call it at all and
 * instead run `npm run job:enforce-silence` from a single external
 * scheduler (cron, a Kubernetes CronJob, etc.) — see scripts/enforce-silence-sweep.ts.
 *
 * Returns a function that stops the interval, for tests/graceful shutdown.
 */
export function startEnforceSilenceScheduler(
  prisma: PrismaClient,
  intervalMinutes: number = DEFAULT_INTERVAL_MINUTES,
): () => void {
  const intervalMs = intervalMinutes * 60 * 1000;

  const tick = async () => {
    try {
      const results = await runEnforceSilenceSweep(prisma);
      if (results.length > 0) {
        console.log(
          `[enforce-silence] enforced ${results.length} silent obligation(s):`,
          results.map((r) => `${r.userId}@${r.matchId}`).join(", "),
        );
      }
    } catch (err) {
      console.error("[enforce-silence] sweep failed:", err);
    }
  };

  void tick(); // run once immediately so a restart doesn't wait a full interval
  const handle = setInterval(tick, intervalMs);
  handle.unref?.(); // don't keep the process alive just for this timer

  return () => clearInterval(handle);
}

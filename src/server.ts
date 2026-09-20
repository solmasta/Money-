import express from "express";
import path from "node:path";
import { usersRouter } from "./routes/users.js";
import { matchesRouter } from "./routes/matches.js";
import { datesRouter } from "./routes/dates.js";
import { successRouter } from "./routes/success.js";
import { vouchesRouter } from "./routes/vouches.js";
import { prisma } from "./db.js";
import { startEnforceSilenceScheduler, startAccountabilityResetScheduler } from "./jobs/scheduler.js";

const app = express();
app.use(express.json());

// Resolved from the working directory (always the repo root — how `npm run
// dev`/`npm start` both invoke this) rather than __dirname, since tsc's
// output layout (dist/src/server.js, because tsconfig's rootDir has to
// cover src/, prisma/, and scripts/ as siblings) puts this file at a
// different depth than the uncompiled src/server.ts tsx runs directly.
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/users", usersRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/vouches", vouchesRouter);
app.use("/api", datesRouter);
app.use("/api", successRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal error" });
});

const port = Number(process.env.PORT ?? 3000);
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`CLOSURE API listening on http://localhost:${port}`);
  });

  // Disable either when running multiple instances of this server behind a
  // load balancer — run the matching `npm run job:*` script from a single
  // external scheduler instead. See src/jobs/scheduler.ts.
  if (process.env.ENFORCE_SILENCE_DISABLED !== "true") {
    const intervalMinutes = Number(process.env.ENFORCE_SILENCE_INTERVAL_MINUTES ?? 15);
    startEnforceSilenceScheduler(prisma, intervalMinutes);
  }
  if (process.env.ACCOUNTABILITY_RESET_DISABLED !== "true") {
    const intervalMinutes = Number(process.env.ACCOUNTABILITY_RESET_INTERVAL_MINUTES ?? 60);
    startAccountabilityResetScheduler(prisma, intervalMinutes);
  }
}

export { app };

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { usersRouter } from "./routes/users.js";
import { matchesRouter } from "./routes/matches.js";
import { datesRouter } from "./routes/dates.js";
import { successRouter } from "./routes/success.js";
import { vouchesRouter } from "./routes/vouches.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, "..", "public")));

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
}

export { app };

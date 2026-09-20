import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const vouchesRouter = Router();

const vouchSchema = z.object({
  voucherId: z.string(),
  voucheeId: z.string(),
  statement: z.string().min(1),
});

/** The vouching web: a portable trust signal layered on top of mandatory ID
 * + liveness verification. */
vouchesRouter.post("/", async (req, res) => {
  const parsed = vouchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.voucherId === parsed.data.voucheeId) {
    return res.status(400).json({ error: "cannot vouch for yourself" });
  }

  const vouch = await prisma.vouch.create({ data: parsed.data });
  res.status(201).json(vouch);
});

vouchesRouter.get("/for/:userId", async (req, res) => {
  const vouches = await prisma.vouch.findMany({
    where: { voucheeId: req.params.userId },
    include: { voucher: { select: { id: true, displayName: true } } },
  });
  res.json(vouches);
});

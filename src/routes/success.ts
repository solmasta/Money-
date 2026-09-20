import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { SUCCESS_FEE_CENTS } from "../domain/payments.js";
import { paymentProvider } from "../adapters/index.js";

export const successRouter = Router();

const reportSchema = z.object({ reportedByUserId: z.string() });

/**
 * "We win when you leave." The success fee is charged when a user reports
 * their match became a relationship — the moment the app's incentive
 * structure inverts a normal dating app's: this is revenue tied to an exit,
 * not to continued engagement.
 */
successRouter.post("/matches/:id/report-success", async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const match = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!match) return res.status(404).json({ error: "not found" });
  if (![match.userAId, match.userBId].includes(parsed.data.reportedByUserId)) {
    return res.status(403).json({ error: "user is not part of this match" });
  }

  const charges = await Promise.all(
    [match.userAId, match.userBId].map(async (userId) => {
      const result = await paymentProvider.charge(userId, SUCCESS_FEE_CENTS, "CLOSURE success fee");
      return prisma.payment.create({
        data: {
          userId,
          type: "SUCCESS_FEE",
          amountCents: SUCCESS_FEE_CENTS,
          status: result.status === "SUCCEEDED" ? "SUCCEEDED" : "FAILED",
          providerRef: result.providerRef,
        },
      });
    }),
  );

  const updated = await prisma.match.update({ where: { id: match.id }, data: { status: "CLOSED" } });

  res.json({ match: updated, charges });
});

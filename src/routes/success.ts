import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { SUCCESS_FEE_CENTS } from "../domain/payments.js";
import { releaseClosureDepositOnSuccess } from "../domain/escrow.js";
import { paymentProvider } from "../adapters/index.js";

export const successRouter = Router();

const reportSchema = z.object({ reportedByUserId: z.string() });

/**
 * "We win when you leave." The success fee is charged when a user reports
 * their match became a relationship — the moment the app's incentive
 * structure inverts a normal dating app's: this is revenue tied to an exit,
 * not to continued engagement.
 *
 * Success also resolves the Closure Guarantee's escrow deposit for both
 * sides: nobody owes closure when the match worked. Whoever approved (and
 * so had a deposit held) gets it released back rather than leaving it
 * stuck in limbo — otherwise it would never be resolved, since the match
 * closes here without either side ever filing a ClosureEvent.
 */
successRouter.post("/matches/:id/report-success", async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const match = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!match) return res.status(404).json({ error: "not found" });
  if (![match.userAId, match.userBId].includes(parsed.data.reportedByUserId)) {
    return res.status(403).json({ error: "user is not part of this match" });
  }
  if (match.status === "CLOSED") {
    return res.status(409).json({ error: "match is already closed" });
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

  const escrowReleases = await Promise.all(
    [match.userAId, match.userBId].map((userId) => releaseClosureDepositOnSuccess(prisma, userId, match.id)),
  );

  const updated = await prisma.match.update({ where: { id: match.id }, data: { status: "CLOSED" } });

  res.json({ match: updated, charges, escrowReleases: escrowReleases.filter((r) => r !== null) });
});

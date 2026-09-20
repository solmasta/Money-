import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { cancellationConsequence, countCancellationsInWindow } from "../domain/dates.js";
import { PAY_PER_DATE_CENTS } from "../domain/payments.js";
import { applyCancellationSuspensionPenalty } from "../domain/accountabilityReset.js";
import { paymentProvider } from "../adapters/index.js";

export const datesRouter = Router();

const proposeSchema = z.object({ scheduledAt: z.coerce.date() });

datesRouter.post("/matches/:matchId/dates", async (req, res) => {
  const parsed = proposeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const match = await prisma.match.findUnique({ where: { id: req.params.matchId } });
  if (!match) return res.status(404).json({ error: "not found" });

  const dateProposal = await prisma.dateProposal.create({
    data: { matchId: match.id, scheduledAt: parsed.data.scheduledAt, status: "SCHEDULED" },
  });
  await prisma.match.update({ where: { id: match.id }, data: { status: "DATE_SCHEDULED" } });

  res.status(201).json(dateProposal);
});

/**
 * Pay-per-date charges fire only here — on confirmed attendance, never on
 * matching, messaging, or scheduling. Charges both participants
 * independently so either side's card failure doesn't block the other's
 * record from reflecting reality.
 */
datesRouter.post("/dates/:id/attend", async (req, res) => {
  const dateProposal = await prisma.dateProposal.findUnique({
    where: { id: req.params.id },
    include: { match: true },
  });
  if (!dateProposal) return res.status(404).json({ error: "not found" });

  const { userAId, userBId } = dateProposal.match;
  const charges = await Promise.all(
    [userAId, userBId].map(async (userId) => {
      const result = await paymentProvider.charge(userId, PAY_PER_DATE_CENTS, "CLOSURE pay-per-date");
      return prisma.payment.create({
        data: {
          userId,
          type: "PAY_PER_DATE",
          amountCents: PAY_PER_DATE_CENTS,
          status: result.status === "SUCCEEDED" ? "SUCCEEDED" : "FAILED",
          providerRef: result.providerRef,
        },
      });
    }),
  );

  const updated = await prisma.dateProposal.update({
    where: { id: dateProposal.id },
    data: { status: "CONFIRMED_ATTENDED", attendedAt: new Date() },
  });
  await prisma.match.update({ where: { id: dateProposal.matchId }, data: { status: "DATE_COMPLETED" } });

  res.json({ dateProposal: updated, charges });
});

const cancelSchema = z.object({ userId: z.string() });

/**
 * Cancellation ladder: first cancellation in the rolling window is free,
 * the next two incur a fee, further ones suspend the user.
 * `priorCancellationCount` only counts cancellations within
 * CANCELLATION_WINDOW_DAYS — an older cancellation has aged out of the
 * ladder (and, if it was the one that triggered a SUSPENSION penalty, that
 * penalty auto-reverses around the same time — see
 * src/domain/accountabilityReset.ts).
 */
datesRouter.post("/dates/:id/cancel", async (req, res) => {
  const parsed = cancelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const dateProposal = await prisma.dateProposal.findUnique({ where: { id: req.params.id } });
  if (!dateProposal) return res.status(404).json({ error: "not found" });

  const now = new Date();
  const priorCancellationCount = await countCancellationsInWindow(prisma, parsed.data.userId, now);

  const consequence = cancellationConsequence(priorCancellationCount);

  let payment = null;
  if (consequence.feeCents > 0) {
    const result = await paymentProvider.charge(
      parsed.data.userId,
      consequence.feeCents,
      `CLOSURE cancellation fee (${consequence.tier})`,
    );
    payment = await prisma.payment.create({
      data: {
        userId: parsed.data.userId,
        type: "CANCELLATION_FEE",
        amountCents: consequence.feeCents,
        status: result.status === "SUCCEEDED" ? "SUCCEEDED" : "FAILED",
        providerRef: result.providerRef,
      },
    });
  }

  const updated = await prisma.dateProposal.update({
    where: { id: dateProposal.id },
    data: { status: "CANCELLED", cancelledByUserId: parsed.data.userId, cancelledAt: now },
  });

  const userUpdate =
    consequence.tier === "SUSPENSION"
      ? await applyCancellationSuspensionPenalty(prisma, parsed.data.userId, dateProposal.id, now)
      : null;

  res.json({ dateProposal: updated, consequence, payment, userUpdate });
});

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { profileExtractor, verificationProvider } from "../adapters/index.js";
import { changeIntent, DEFAULT_INTENT_LOCK_DAYS, type Intent } from "../domain/intent.js";

export const usersRouter = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
});

usersRouter.post("/", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.create({ data: parsed.data });
  res.status(201).json(user);
});

usersRouter.get("/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { preferenceProfile: true },
  });
  if (!user) return res.status(404).json({ error: "not found" });
  res.json(user);
});

const interviewSchema = z.object({
  transcript: z.array(z.object({ speaker: z.enum(["agent", "user"]), text: z.string() })).min(1),
});

/**
 * Stands in for the full Twilio call + Deepgram STT pipeline: the caller
 * supplies a transcript directly (as if STT already ran), and this endpoint
 * runs the GPT-4o-equivalent structured extraction over it, persists the
 * PreferenceProfile, and locks intent for DEFAULT_INTENT_LOCK_DAYS.
 */
usersRouter.post("/:id/interview", async (req, res) => {
  const parsed = interviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "not found" });

  const extracted = await profileExtractor.extract(parsed.data.transcript);
  const rawTranscript = JSON.stringify(parsed.data.transcript);

  const profile = await prisma.preferenceProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      values: JSON.stringify(extracted.values),
      dealbreakers: JSON.stringify(extracted.dealbreakers),
      attachmentStyle: extracted.attachmentStyle,
      relationshipHistorySummary: extracted.relationshipHistorySummary,
      vector: JSON.stringify(extracted.vector),
      rawTranscript,
    },
    update: {
      values: JSON.stringify(extracted.values),
      dealbreakers: JSON.stringify(extracted.dealbreakers),
      attachmentStyle: extracted.attachmentStyle,
      relationshipHistorySummary: extracted.relationshipHistorySummary,
      vector: JSON.stringify(extracted.vector),
      rawTranscript,
    },
  });

  const now = new Date();
  const lockedAt = changeIntent(user.intentLockedAt, user.intentLockDays ?? DEFAULT_INTENT_LOCK_DAYS, now);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { intent: extracted.intent as Intent, intentLockedAt: lockedAt },
  });

  res.json({ user: updatedUser, profile });
});

const verifySchema = z.object({
  documentRef: z.string().optional(),
  selfieRef: z.string().optional(),
});

usersRouter.post("/:id/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: "not found" });

  const idResult = await verificationProvider.verifyIdentity(user.id, parsed.data.documentRef ?? "");
  const livenessResult = await verificationProvider.verifyLiveness(user.id, parsed.data.selfieRef ?? "");

  const status =
    idResult.status === "VERIFIED" && livenessResult.status === "VERIFIED" ? "VERIFIED" : "FAILED";

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { verificationStatus: status },
  });

  res.json({ user: updated, idResult, livenessResult });
});

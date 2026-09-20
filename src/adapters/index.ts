// Composition root for adapters. All are Mock implementations today; swap
// each for a Real one behind the same interface (src/adapters/types.ts) once
// credentials for Twilio/Deepgram/OpenAI/a verification vendor/Stripe exist.
// Nothing outside this file needs to know which implementation is active.

import type { VoiceInterviewTurn } from "./types.js";
import {
  MockVoicePipeline,
  MockProfileExtractor,
  MockVerificationProvider,
  MockPaymentProvider,
} from "./mock.js";

// In-memory side channel the mock voice pipeline reads from — see
// MockVoicePipeline's doc comment. A real pipeline wouldn't need this.
export const pendingTranscripts = new Map<string, VoiceInterviewTurn[]>();

export const voicePipeline = new MockVoicePipeline(pendingTranscripts);
export const profileExtractor = new MockProfileExtractor();
export const verificationProvider = new MockVerificationProvider();
export const paymentProvider = new MockPaymentProvider();

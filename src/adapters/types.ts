// Adapter contracts for every external dependency named in the CLOSURE spec.
// Each has a Mock implementation so the whole product runs with zero API
// keys. Swap the Mock for a Real implementation behind the same interface
// when credentials are available — nothing above this layer changes.

export interface VoiceInterviewTurn {
  speaker: "agent" | "user";
  text: string;
}

/** Twilio (call handling) + Deepgram (STT) combined pipeline contract. */
export interface VoicePipeline {
  /** Starts a voice interview call and returns the full transcript once done. */
  runInterview(userId: string): Promise<VoiceInterviewTurn[]>;
}

export interface ExtractedProfile {
  values: string[];
  dealbreakers: string[];
  attachmentStyle: string;
  relationshipHistorySummary: string;
  intent: "CASUAL" | "LONG_TERM" | "MARRIAGE_MINDED" | "UNSURE";
  vector: number[];
}

/** GPT-4o structured-output extraction from an interview transcript. */
export interface ProfileExtractor {
  extract(transcript: VoiceInterviewTurn[]): Promise<ExtractedProfile>;
}

export interface VerificationResult {
  status: "VERIFIED" | "FAILED" | "PENDING";
  reason?: string;
}

/** National eID + facial liveness check. */
export interface VerificationProvider {
  verifyIdentity(userId: string, documentRef: string): Promise<VerificationResult>;
  verifyLiveness(userId: string, selfieRef: string): Promise<VerificationResult>;
}

export interface ChargeResult {
  providerRef: string;
  status: "SUCCEEDED" | "FAILED" | "PENDING";
}

/** Stripe payments: pay-per-date, success fee, cancellation fee. */
export interface PaymentProvider {
  charge(userId: string, amountCents: number, description: string): Promise<ChargeResult>;
  refund(providerRef: string): Promise<ChargeResult>;
}

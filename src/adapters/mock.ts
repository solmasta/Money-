import type {
  VoicePipeline,
  VoiceInterviewTurn,
  ProfileExtractor,
  ExtractedProfile,
  VerificationProvider,
  VerificationResult,
  PaymentProvider,
  ChargeResult,
} from "./types.js";

const VECTOR_DIM = 32;

/**
 * Deterministic bag-of-words hashing embedding. Stands in for a real
 * text-embedding-3 / GPT-4o embedding call so matching logic is testable
 * without network access. Swap for a real embedding model in production —
 * the rest of the matching pipeline only depends on cosine similarity over
 * fixed-length vectors, so the replacement is drop-in.
 */
export function hashEmbed(text: string, dim = VECTOR_DIM): number[] {
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) >>> 0;
    }
    vec[hash % dim] += 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/** Real implementation would place an outbound Twilio call and stream audio
 * to Deepgram for live transcription. The mock instead accepts a
 * pre-supplied transcript (e.g. typed in a web form during development)
 * via a side channel set by the caller before invocation. */
export class MockVoicePipeline implements VoicePipeline {
  constructor(private readonly transcripts: Map<string, VoiceInterviewTurn[]>) {}

  async runInterview(userId: string): Promise<VoiceInterviewTurn[]> {
    const transcript = this.transcripts.get(userId);
    if (!transcript) {
      throw new Error(`No transcript registered for user ${userId} in mock voice pipeline`);
    }
    return transcript;
  }
}

const DEALBREAKER_KEYWORDS = [
  "smoking",
  "kids",
  "children",
  "religion",
  "monogamy",
  "long distance",
  "pets",
  "drinking",
];

const VALUE_KEYWORDS = [
  "honesty",
  "ambition",
  "family",
  "adventure",
  "stability",
  "humor",
  "independence",
  "spirituality",
  "fitness",
  "career",
];

const INTENT_KEYWORDS: Record<ExtractedProfile["intent"], string[]> = {
  MARRIAGE_MINDED: ["marriage", "marry", "wife", "husband", "settle down"],
  LONG_TERM: ["long-term", "long term", "relationship", "partner for life", "serious"],
  CASUAL: ["casual", "no strings", "just fun", "not looking for anything serious"],
  UNSURE: [],
};

/** Real implementation calls GPT-4o with a structured-output schema over the
 * transcript. The mock runs keyword extraction plus the hashing embedding
 * above — enough to exercise the full pipeline deterministically in tests. */
export class MockProfileExtractor implements ProfileExtractor {
  async extract(transcript: VoiceInterviewTurn[]): Promise<ExtractedProfile> {
    const fullText = transcript
      .filter((t) => t.speaker === "user")
      .map((t) => t.text)
      .join(" ")
      .toLowerCase();

    const dealbreakers = DEALBREAKER_KEYWORDS.filter((k) => fullText.includes(k));
    const values = VALUE_KEYWORDS.filter((k) => fullText.includes(k));

    let intent: ExtractedProfile["intent"] = "UNSURE";
    for (const [key, keywords] of Object.entries(INTENT_KEYWORDS) as [
      ExtractedProfile["intent"],
      string[],
    ][]) {
      if (keywords.some((k) => fullText.includes(k))) {
        intent = key;
        break;
      }
    }

    const attachmentStyle = /anxious|worry|clingy/.test(fullText)
      ? "anxious"
      : /avoidant|distance|independent/.test(fullText)
        ? "avoidant"
        : "secure";

    return {
      values: values.length ? values : ["honesty"],
      dealbreakers,
      attachmentStyle,
      relationshipHistorySummary: fullText.slice(0, 280),
      intent,
      vector: hashEmbed(fullText),
    };
  }
}

/** Real implementation calls a national eID provider + a liveness-detection
 * vendor. The mock approves any non-empty reference, which is enough to
 * exercise the "Verified Human" gating logic elsewhere. */
export class MockVerificationProvider implements VerificationProvider {
  async verifyIdentity(_userId: string, documentRef: string): Promise<VerificationResult> {
    return documentRef ? { status: "VERIFIED" } : { status: "FAILED", reason: "missing document" };
  }

  async verifyLiveness(_userId: string, selfieRef: string): Promise<VerificationResult> {
    return selfieRef ? { status: "VERIFIED" } : { status: "FAILED", reason: "missing selfie" };
  }
}

/** Real implementation creates a Stripe PaymentIntent / Refund. The mock
 * always succeeds so payment-gated flows (pay-per-date, success fee,
 * cancellation ladder) can be tested without a Stripe account. */
export class MockPaymentProvider implements PaymentProvider {
  private counter = 0;

  async charge(_userId: string, _amountCents: number, _description: string): Promise<ChargeResult> {
    this.counter += 1;
    return { providerRef: `mock_charge_${this.counter}`, status: "SUCCEEDED" };
  }

  async refund(providerRef: string): Promise<ChargeResult> {
    return { providerRef: `${providerRef}_refund`, status: "SUCCEEDED" };
  }
}

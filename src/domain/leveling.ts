// Real multiplayer leveling: XP and level are earned by real users
// answering real trust prompts (src/domain/promptPool.ts) with real
// matches, resolved through src/domain/trustPrompts.ts. Pure rules live
// here — mirrors the mechanics validated in the "Trust Quest" prototype,
// now driving actual persisted state instead of scripted NPCs.

export const RESPONSE_STYLES = ["DIRECT", "GUARDED", "DEFLECT"] as const;
export type ResponseStyle = (typeof RESPONSE_STYLES)[number];

export function isValidResponseStyle(style: string): style is ResponseStyle {
  return (RESPONSE_STYLES as readonly string[]).includes(style);
}

/** XP a user earns for their own response — independent of how (or
 * whether) their match has answered the same prompt. Leveling reflects
 * your own proven honesty, not the other person's, and not time spent. */
export const XP_FOR_STYLE: Record<ResponseStyle, number> = {
  DIRECT: 5,
  GUARDED: 2,
  DEFLECT: 0,
};

/**
 * Trust a Match gains once BOTH sides have answered the same prompt —
 * one person being open while the other deflects earns some credit, but
 * far less than mutual openness. Both sides deflecting actively costs
 * trust. Symmetric: order of the two styles doesn't matter.
 */
const TRUST_MATRIX: Record<ResponseStyle, Record<ResponseStyle, number>> = {
  DIRECT: { DIRECT: 10, GUARDED: 6, DEFLECT: 2 },
  GUARDED: { DIRECT: 6, GUARDED: 4, DEFLECT: 1 },
  DEFLECT: { DIRECT: 2, GUARDED: 1, DEFLECT: -1 },
};

export function trustDeltaForPair(a: ResponseStyle, b: ResponseStyle): number {
  return TRUST_MATRIX[a][b];
}

/** xp required to REACH each level; index 0 is level 1 (always 0 xp). */
export const LEVEL_THRESHOLDS = [0, 50, 120, 210, 320, 450, 600, 770, 960, 1170];
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return Math.min(level, MAX_LEVEL);
}

/** How much xp into the current level, and how much the level spans —
 * for rendering a progress bar. `span` is 0 at max level. */
export function xpProgress(xp: number): { into: number; span: number; level: number } {
  const level = levelForXp(xp);
  const lo = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const hi = level < MAX_LEVEL ? LEVEL_THRESHOLDS[level] : lo;
  return { into: xp - lo, span: hi - lo, level };
}

/** A Match's trust locks in as a permanent, real connection once it
 * crosses this line — the database-backed version of the prototype's
 * "Connection Guaranteed" moment. */
export const GUARANTEE_TRUST = 80;

export interface Perk {
  level: number;
  name: string;
  description: string;
  /** Whether this perk is wired to real behavior in this version, or is
   * still informational (shown, not yet enforced anywhere). Kept honest
   * rather than silently claiming more than what's built — same spirit
   * as the README's "What's intentionally not built yet". */
  implemented: boolean;
}

export const PERKS: Perk[] = [
  { level: 1, name: "One conversation at a time", description: "No feed, no swiping — just the person in front of you.", implemented: true },
  { level: 2, name: "Read the room", description: "See a hint about what this match values before you answer their next prompt.", implemented: true },
  { level: 3, name: "Faster matching", description: "Your agent starts surfacing compatible people sooner.", implemented: false },
  { level: 4, name: "Two conversations at once", description: "Enough trust earned that the app lets you hold two threads.", implemented: false },
  { level: 5, name: "Trust bonus", description: "Your DIRECT answers count for extra trust.", implemented: false },
  { level: 6, name: "Second look", description: "A past no-longer-active match can be reopened once.", implemented: false },
  { level: 7, name: "Priority queue", description: "Your profile surfaces first among equally-compatible matches.", implemented: false },
  { level: 8, name: "Lower bar to lock in", description: "Guaranteed Connection triggers sooner for your matches.", implemented: false },
  { level: 9, name: "Vouch weight", description: "A vouch you give counts double for the person you vouch for.", implemented: false },
  { level: 10, name: "Matchmaker's favor", description: "One guaranteed high-compatibility introduction, on request.", implemented: false },
];

export function unlockedPerks(level: number): Perk[] {
  return PERKS.filter((p) => p.level <= level);
}

// Shared trust-building prompts used across every real match — generic by
// design (not written for a specific pair of people), since these run
// between whichever two real users get matched. Each prompt offers three
// ways to answer it; picking one is the real behavior XP/trust are earned
// from (see src/domain/leveling.ts) — not the literal text, which is
// canned, but the choice of how openly to engage.

export interface PromptOption {
  style: "DIRECT" | "GUARDED" | "DEFLECT";
  label: string;
}

export interface Prompt {
  question: string;
  options: PromptOption[];
}

export const PROMPT_POOL: Prompt[] = [
  {
    question: "What are you actually looking for right now?",
    options: [
      { style: "DIRECT", label: "Say exactly what you want, even if it's a lot to admit." },
      { style: "GUARDED", label: "Give a true but safe, general answer." },
      { style: "DEFLECT", label: "Turn the question back around instead of answering." },
    ],
  },
  {
    question: "Have you ever ghosted someone, or been ghosted? What happened?",
    options: [
      { style: "DIRECT", label: "Tell the real story, including your own part in it." },
      { style: "GUARDED", label: "Acknowledge it happened without getting into specifics." },
      { style: "DEFLECT", label: "Change the subject." },
    ],
  },
  {
    question: "What's something you're bad at admitting you want?",
    options: [
      { style: "DIRECT", label: "Actually say it." },
      { style: "GUARDED", label: "Give a safe, funny non-answer." },
      { style: "DEFLECT", label: "Laugh it off and move on." },
    ],
  },
  {
    question: "If this stopped working between us, would you tell me why?",
    options: [
      { style: "DIRECT", label: "\"Yes — every time.\" And mean it." },
      { style: "GUARDED", label: "\"I'd try to.\"" },
      { style: "DEFLECT", label: "Joke about it instead of answering." },
    ],
  },
  {
    question: "What's the last thing that didn't work out for you, honestly — not the polished version?",
    options: [
      { style: "DIRECT", label: "Give the real, unflattering version." },
      { style: "GUARDED", label: "Give the polished version anyway." },
      { style: "DEFLECT", label: "\"Long story\" — and leave it there." },
    ],
  },
  {
    question: "What would it take for you to actually follow through on plans with someone?",
    options: [
      { style: "DIRECT", label: "Give a real, specific answer." },
      { style: "GUARDED", label: "\"I usually just... do.\" True, but thin." },
      { style: "DEFLECT", label: "Deflect with a joke." },
    ],
  },
  {
    question: "Do you trust easily, or does it take a while?",
    options: [
      { style: "DIRECT", label: "Say where you actually are with it, and why." },
      { style: "GUARDED", label: "Give a short, safe answer." },
      { style: "DEFLECT", label: "Reassure them too fast, too smooth." },
    ],
  },
  {
    question: "What does actually following through look like to you, in practice?",
    options: [
      { style: "DIRECT", label: "Give a concrete, specific answer." },
      { style: "GUARDED", label: "Give a vague, agreeable answer." },
      { style: "DEFLECT", label: "Dodge specifics entirely." },
    ],
  },
  {
    question: "Is there something about yourself you're still figuring out that's relevant here?",
    options: [
      { style: "DIRECT", label: "Share it, even unresolved." },
      { style: "GUARDED", label: "Gesture at it without details." },
      { style: "DEFLECT", label: "Say \"nope, all good\" and move on." },
    ],
  },
  {
    question: "What would make you walk away from this, no matter how well it's going otherwise?",
    options: [
      { style: "DIRECT", label: "Name the actual dealbreaker." },
      { style: "GUARDED", label: "Give a soft, generic answer." },
      { style: "DEFLECT", label: "\"I don't really have one\" — even if that's not true." },
    ],
  },
];

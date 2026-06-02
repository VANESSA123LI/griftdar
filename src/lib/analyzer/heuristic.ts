/**
 * HeuristicAnalyzer
 * =================
 * A transparent, placeholder scoring module. It is intentionally simple and
 * fully isolated behind the `Analyzer` interface so it can be swapped for a
 * different architecture (ML model, LLM, external service, ...) WITHOUT
 * touching the API route, providers, or frontend.
 *
 * How scoring works
 * -----------------
 * Each signal is a pure function `(profile) => Signal` that returns:
 *   - label:        short name shown in the UI
 *   - value:        0..1, where 1 = maximally "grifty"
 *   - weight:       relative importance (need not sum to 1; we normalize)
 *   - explanation:  human-readable, shown to the user
 *
 * Final score = round( 100 * Σ(value*weight) / Σ(weight) ), clamped to 0..100.
 *
 * To add a signal: write a `SignalFn` and add it to `SIGNALS`. To change the
 * architecture entirely: write a new class implementing `Analyzer` and select
 * it in `analyzer/index.ts`. Nothing else needs to change.
 *
 * IMPORTANT: This is an informational heuristic, not a factual determination
 * about any individual. The UI shows a disclaimer to that effect.
 */

import type { Analyzer, AnalysisResult, ProfileData, Signal } from "@/lib/types";

type SignalFn = (profile: ProfileData) => Signal;

/** Buzzwords/cliches commonly over-represented in self-promotional profiles. */
const BUZZWORDS = [
  "visionary",
  "thought leader",
  "guru",
  "ninja",
  "rockstar",
  "10x",
  "growth hacker",
  "serial entrepreneur",
  "disruptor",
  "disrupt",
  "synergy",
  "results-driven",
  "passionate",
  "world-class",
  "world class",
  "award-winning",
  "award winning",
  "unicorn",
  "revolutionize",
  "game-changer",
  "game changer",
  "hustle",
  "grind",
  "crushing it",
  "next-level",
  "next level",
  "cutting-edge",
  "cutting edge",
  "rising star",
  "influencer",
  "evangelist",
  "wizard",
  "maverick",
];

/** Phrases that promise outcomes without verifiable substance. */
const VAGUE_CLAIMS = [
  "as featured in",
  "forbes",
  "as seen on",
  "dm me",
  "the secret",
  "nobody tells you",
  "overnight",
  "proprietary framework",
  "unlock your",
  "inner unicorn",
  "change your life",
  "financial freedom",
  "passive income",
  "trust me",
  "i'll teach you",
  "free masterclass",
  "limited spots",
  "link in bio",
];

/** Inflated/abstract title words that often signal puffery. */
const INFLATED_TITLES = [
  "visionary",
  "chief visionary",
  "evangelist",
  "ninja",
  "rockstar",
  "guru",
  "thought leader",
  "growth hacker",
  "global head",
  "head of everything",
];

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const lc = (s?: string) => (s ?? "").toLowerCase();

/** Count occurrences of any phrase in `phrases` within `text`. */
function countMatches(text: string, phrases: string[]): number {
  let count = 0;
  for (const p of phrases) {
    // Split on the phrase; (occurrences) = (parts - 1).
    count += text.split(p).length - 1;
  }
  return count;
}

/** Approximate word count of a string. */
function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

/** Buzzword density across headline + about, scaled against text length. */
const buzzwordDensity: SignalFn = (profile) => {
  const text = `${lc(profile.headline)} ${lc(profile.about)}`;
  const words = Math.max(wordCount(text), 1);
  const hits = countMatches(text, BUZZWORDS);
  // ~1 buzzword per 12 words reads as saturated.
  const density = hits / words;
  const value = clamp01(density / (1 / 12));
  return {
    label: "Buzzword density",
    value,
    weight: 0.3,
    explanation:
      hits === 0
        ? "Headline and about contain few or no promotional buzzwords."
        : `Found ${hits} buzzword${hits === 1 ? "" : "s"} (e.g. visionary, 10x, guru) ` +
          `across ${words} words of headline/about — higher density reads as self-promotional.`,
  };
};

/**
 * Title-vs-tenure mismatch: senior/founder titles held for very short stints,
 * or many roles in a short total career, suggest inflated or churny titles.
 */
const titleTenureMismatch: SignalFn = (profile) => {
  const exps = profile.experiences ?? [];
  if (exps.length === 0) {
    return {
      label: "Title vs. tenure",
      value: 0.5,
      weight: 0.25,
      explanation: "No experience history available to assess tenure.",
    };
  }

  const seniorPattern =
    /\b(chief|founder|ceo|cxo|c[a-z]o|head|vp|vice president|director|global|president)\b/i;

  let shortSeniorRoles = 0;
  let seniorRoles = 0;
  for (const e of exps) {
    if (seniorPattern.test(e.title)) {
      seniorRoles++;
      if ((e.durationMonths ?? 0) > 0 && (e.durationMonths ?? 0) < 12)
        shortSeniorRoles++;
    }
  }

  const ratio = seniorRoles > 0 ? shortSeniorRoles / seniorRoles : 0;
  const value = clamp01(ratio);
  return {
    label: "Title vs. tenure",
    value,
    weight: 0.25,
    explanation:
      seniorRoles === 0
        ? "No senior/executive titles to evaluate for tenure mismatch."
        : `${shortSeniorRoles} of ${seniorRoles} senior/executive role${
            seniorRoles === 1 ? "" : "s"
          } lasted under a year — short tenure in lofty titles can indicate inflation.`,
  };
};

/** Vague, unverifiable claims and call-to-action / hype phrasing. */
const vagueClaims: SignalFn = (profile) => {
  const text = `${lc(profile.headline)} ${lc(profile.about)}`;
  const hits = countMatches(text, VAGUE_CLAIMS) + countMatches(text, INFLATED_TITLES);
  // 4+ such phrases saturates the signal.
  const value = clamp01(hits / 4);
  return {
    label: "Vague / unverifiable claims",
    value,
    weight: 0.25,
    explanation:
      hits === 0
        ? "No obvious unverifiable claims or sales-pitch phrasing detected."
        : `Detected ${hits} unverifiable or sales-pitch phrase${
            hits === 1 ? "" : "s"
          } (e.g. "as featured in", "DM me", "the secret nobody tells you").`,
  };
};

/**
 * Follower-to-substance ratio: a large following paired with thin, hype-heavy
 * substance (short about, few real roles) is a classic influencer-grift shape.
 */
const followerToSubstance: SignalFn = (profile) => {
  const followers = profile.followerCount ?? 0;
  if (followers <= 0) {
    return {
      label: "Follower-to-substance ratio",
      value: 0.1,
      weight: 0.2,
      explanation: "No follower count available; treated as low signal.",
    };
  }

  const aboutWords = wordCount(lc(profile.about));
  const roles = (profile.experiences ?? []).length;
  // Substance proxy: real roles + a chunk of about text.
  const substance = roles + aboutWords / 50;
  // followers per unit of substance; 50k+ per unit reads as imbalanced.
  const perSubstance = followers / Math.max(substance, 0.5);
  const value = clamp01(perSubstance / 50000);
  return {
    label: "Follower-to-substance ratio",
    value,
    weight: 0.2,
    explanation:
      `~${Intl.NumberFormat("en").format(followers)} followers against a thin substance ` +
      `profile (${roles} role${roles === 1 ? "" : "s"}, ${aboutWords} words of about). ` +
      (value > 0.5
        ? "Large audience with little verifiable substance is a common grift pattern."
        : "Audience size is roughly in line with profile substance."),
  };
};

/** Ordered list of active signals. Edit this to add/remove/reweight signals. */
export const SIGNALS: readonly SignalFn[] = [
  buzzwordDensity,
  titleTenureMismatch,
  vagueClaims,
  followerToSubstance,
];

export class HeuristicAnalyzer implements Analyzer {
  async analyze(profile: ProfileData): Promise<AnalysisResult> {
    const signals: Signal[] = SIGNALS.map((fn) => {
      const s = fn(profile);
      return { ...s, value: clamp01(s.value) };
    });

    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const weighted = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
    const score =
      totalWeight > 0 ? Math.round((100 * weighted) / totalWeight) : 0;

    return { score: Math.max(0, Math.min(100, score)), signals };
  }
}

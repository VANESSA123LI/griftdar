/**
 * Core domain types shared across the scraping (DataProvider) and scoring
 * (Analyzer) layers. These are intentionally provider-agnostic so that any
 * DataProvider implementation can produce a `ProfileData` and any Analyzer
 * can consume it without knowing where the data came from.
 */

/** Normalized public profile data, independent of the source provider. */
export interface ProfileData {
  url: string;
  name?: string;
  headline?: string;
  about?: string;
  experiences: Experience[];
  followerCount?: number;
  // extend as needed (skills, education, certifications, ...)
}

export interface Experience {
  title: string;
  company: string;
  durationMonths?: number;
}

/**
 * A single scored heuristic signal.
 * - `value` is normalized to 0–1, where 1 = maximally "grifty".
 * - `weight` is the signal's relative contribution to the final score.
 * - `explanation` is human-readable and safe to show to end users.
 */
export interface Signal {
  label: string;
  value: number;
  weight: number;
  explanation: string;
}

/** Output of an Analyzer: a 0–100 score plus the signals that produced it. */
export interface AnalysisResult {
  score: number;
  signals: Signal[];
}

/**
 * The scraping layer. Implementations turn a LinkedIn profile URL into
 * normalized `ProfileData`. See MockProvider (default) and ProxycurlProvider.
 */
export interface DataProvider {
  fetchProfile(url: string): Promise<ProfileData>;
}

/**
 * The scoring layer. Deliberately isolated behind this interface so the
 * scoring architecture can be swapped wholesale without touching the API
 * route, providers, or frontend. See HeuristicAnalyzer.
 */
export interface Analyzer {
  analyze(profile: ProfileData): Promise<AnalysisResult>;
}

/** Error type providers throw on failure, carrying an HTTP-ish status hint. */
export class ProviderError extends Error {
  constructor(
    message: string,
    /** Suggested HTTP status for the API route to surface. */
    public readonly status: number = 502,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

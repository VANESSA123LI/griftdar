import type { Analyzer } from "@/lib/types";
import { HeuristicAnalyzer } from "@/lib/analyzer/heuristic";

/**
 * Returns the active Analyzer. This is the single seam to swap the scoring
 * architecture — replace the implementation here (or branch on an env var)
 * without touching the API route, providers, or frontend.
 */
export function getAnalyzer(): Analyzer {
  return new HeuristicAnalyzer();
}

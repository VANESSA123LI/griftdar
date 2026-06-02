import { NextResponse } from "next/server";
import { validateLinkedInUrl } from "@/lib/validation";
import { getProvider } from "@/lib/providers";
import { getAnalyzer } from "@/lib/analyzer";
import { ProviderError, type AnalysisResult } from "@/lib/types";
import { rateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";

/**
 * POST /api/analyze
 * Body: { "url": "https://www.linkedin.com/in/..." }
 *
 * Flow: rate-limit → validate URL → DataProvider.fetchProfile →
 *       Analyzer.analyze → return score + signals.
 *
 * Privacy: analysis is on-demand per request. Nothing about the analyzed
 * person is persisted; no searchable database is built.
 */

// Run on the Node.js runtime (providers may use Node APIs / fetch with keys).
export const runtime = "nodejs";
// Never cache analysis responses.
export const dynamic = "force-dynamic";

const DISCLAIMER =
  "This score is an automated heuristic generated for informational purposes " +
  "only. It is not a factual claim or determination about any individual.";

export interface AnalyzeResponse extends AnalysisResult {
  profile: {
    url: string;
    name?: string;
    headline?: string;
  };
  disclaimer: string;
}

function errorResponse(message: string, status: number, extraHeaders?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers: extraHeaders });
}

export async function POST(request: Request) {
  // 1) Rate limit per client IP.
  const key = clientKeyFromHeaders(request.headers);
  const rl = rateLimit(`analyze:${key}`, { limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return errorResponse(
      "Too many requests. Please slow down and try again shortly.",
      429,
      { "Retry-After": String(rl.retryAfterSeconds) },
    );
  }

  // 2) Parse body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }
  const url =
    body && typeof body === "object" && "url" in body
      ? (body as { url: unknown }).url
      : undefined;
  if (typeof url !== "string") {
    return errorResponse("Missing required 'url' string in request body.", 400);
  }

  // 3) Validate the URL before doing any work.
  const validation = validateLinkedInUrl(url);
  if (!validation.ok || !validation.normalized) {
    return errorResponse(validation.error ?? "Invalid LinkedIn URL.", 400);
  }

  // 4) Fetch profile via the selected provider.
  let profile;
  try {
    const provider = await getProvider();
    profile = await provider.fetchProfile(validation.normalized);
  } catch (err) {
    if (err instanceof ProviderError) {
      return errorResponse(err.message, err.status);
    }
    // Common misconfiguration: missing API key surfaces here.
    const msg =
      err instanceof Error ? err.message : "Failed to fetch profile data.";
    console.error("[analyze] provider error:", err);
    return errorResponse(
      `Could not retrieve profile data: ${msg}`,
      502,
    );
  }

  // 5) Score it.
  let result: AnalysisResult;
  try {
    const analyzer = getAnalyzer();
    result = await analyzer.analyze(profile);
  } catch (err) {
    console.error("[analyze] analyzer error:", err);
    return errorResponse("Analysis failed unexpectedly.", 500);
  }

  // 6) Respond. We echo only minimal profile context; nothing is persisted.
  const response: AnalyzeResponse = {
    score: result.score,
    signals: result.signals,
    profile: {
      url: profile.url,
      name: profile.name,
      headline: profile.headline,
    },
    disclaimer: DISCLAIMER,
  };

  return NextResponse.json(response, {
    headers: {
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": String(rl.remaining),
      "Cache-Control": "no-store",
    },
  });
}

/** Reject non-POST methods clearly. */
export async function GET() {
  return errorResponse("Use POST with a JSON body { url } to analyze.", 405);
}

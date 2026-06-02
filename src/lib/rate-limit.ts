/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Deliberately dependency-free so the app deploys to Vercel with no extra
 * services (Redis, Upstash, etc.). Limitations to be aware of:
 *   - State lives in the module/process. On Vercel's serverless runtime each
 *     instance has its own window, so this is best-effort, not a hard global
 *     cap. It's enough to blunt casual abuse of an on-demand endpoint.
 *   - For a strict, distributed limit, swap this for a shared store behind the
 *     same `rateLimit()` signature.
 */

interface Window {
  /** Timestamps (ms) of requests still inside the current window. */
  hits: number[];
}

const buckets = new Map<string, Window>();

export interface RateLimitResult {
  ok: boolean;
  /** Max requests allowed per window. */
  limit: number;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Seconds until the caller may retry (when blocked). */
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Max requests per window. Default 10. */
  limit?: number;
  /** Window length in milliseconds. Default 60_000 (1 minute). */
  windowMs?: number;
}

/**
 * Record a hit for `key` and report whether it is allowed.
 * Uses a sliding window: only hits within the last `windowMs` count.
 */
export function rateLimit(
  key: string,
  options: RateLimitOptions = {},
): RateLimitResult {
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const windowStart = now - windowMs;

  const bucket = buckets.get(key) ?? { hits: [] };
  // Drop expired hits.
  bucket.hits = bucket.hits.filter((t) => t > windowStart);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000),
    );
    buckets.set(key, bucket);
    return { ok: false, limit, remaining: 0, retryAfterSeconds };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.hits.every((t) => t <= windowStart)) buckets.delete(k);
    }
  }

  return {
    ok: true,
    limit,
    remaining: Math.max(0, limit - bucket.hits.length),
    retryAfterSeconds: 0,
  };
}

/** Best-effort client identifier from request headers (proxy-aware). */
export function clientKeyFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

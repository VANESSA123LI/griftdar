/**
 * Validation for LinkedIn profile URLs. We only accept canonical personal
 * profile URLs of the form linkedin.com/in/<slug>. Company pages, posts,
 * school pages, and arbitrary hosts are rejected.
 */

export interface UrlValidationResult {
  ok: boolean;
  /** Cleaned, canonical URL when ok; undefined otherwise. */
  normalized?: string;
  /** The extracted profile slug when ok (e.g. "jane-doe"). */
  slug?: string;
  /** User-facing reason when not ok. */
  error?: string;
}

/**
 * Validate and normalize a LinkedIn personal-profile URL.
 *
 * Accepts (case-insensitive host, optional scheme, optional www/locale
 * subdomain, optional trailing slash and query/hash):
 *   - https://www.linkedin.com/in/jane-doe
 *   - linkedin.com/in/jane-doe/
 *   - https://uk.linkedin.com/in/jane-doe?originalSubdomain=uk
 *
 * Rejects company pages, posts, missing slug, and non-LinkedIn hosts.
 */
export function validateLinkedInUrl(input: string): UrlValidationResult {
  const raw = (input ?? "").trim();
  if (!raw) {
    return { ok: false, error: "Please enter a LinkedIn profile URL." };
  }

  // Allow users to omit the scheme.
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "URL must use http or https." };
  }

  // Host must be linkedin.com or a subdomain of it (www, country locales).
  const host = parsed.hostname.toLowerCase();
  const isLinkedIn = host === "linkedin.com" || host.endsWith(".linkedin.com");
  if (!isLinkedIn) {
    return { ok: false, error: "URL must be a linkedin.com profile." };
  }

  // Path must be /in/<slug>. Reject /company/, /school/, /posts/, etc.
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0].toLowerCase() !== "in") {
    return {
      ok: false,
      error: "URL must be a personal profile (linkedin.com/in/...).",
    };
  }

  const slug = decodeURIComponent(segments[1]).trim();
  // Slugs are alphanumeric plus hyphens (and some unicode/percent forms);
  // require at least one usable character and no obvious garbage.
  if (!slug || !/^[\p{L}\p{N}\-_%.]+$/u.test(slug)) {
    return { ok: false, error: "Couldn't find a valid profile name in the URL." };
  }

  const normalized = `https://www.linkedin.com/in/${slug}`;
  return { ok: true, normalized, slug };
}

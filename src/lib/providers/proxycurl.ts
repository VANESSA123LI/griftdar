import {
  type DataProvider,
  type Experience,
  type ProfileData,
  ProviderError,
} from "@/lib/types";

/**
 * ProxycurlProvider — fetches public LinkedIn profile data via the Proxycurl
 * Person Profile API (https://nubela.co/proxycurl). Selected when
 * DATA_PROVIDER=api; requires PROXYCURL_API_KEY.
 *
 * We deliberately call a third-party data API rather than scraping
 * linkedin.com directly (no headless browser).
 */

/** Default Proxycurl Person Profile endpoint; overridable for testing. */
const DEFAULT_ENDPOINT = "https://nubela.co/proxycurl/api/v2/linkedin";

/** Subset of the Proxycurl response we consume. */
interface ProxycurlDate {
  day?: number | null;
  month?: number | null;
  year?: number | null;
}

interface ProxycurlExperience {
  title?: string | null;
  company?: string | null;
  starts_at?: ProxycurlDate | null;
  ends_at?: ProxycurlDate | null;
}

interface ProxycurlProfile {
  full_name?: string | null;
  occupation?: string | null;
  headline?: string | null;
  summary?: string | null;
  experiences?: ProxycurlExperience[] | null;
  follower_count?: number | null;
}

export class ProxycurlProvider implements DataProvider {
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(
    apiKey: string | undefined = process.env.PROXYCURL_API_KEY,
    endpoint: string = process.env.PROXYCURL_ENDPOINT ?? DEFAULT_ENDPOINT,
  ) {
    if (!apiKey) {
      // Surfaced as a clear, actionable error by the API route.
      throw new ProviderError(
        "PROXYCURL_API_KEY is not set. Set it, or use DATA_PROVIDER=mock.",
        500,
      );
    }
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  async fetchProfile(url: string): Promise<ProfileData> {
    const query = new URLSearchParams({
      url,
      // Avoid spending extra credits on data we don't use.
      use_cache: "if-present",
      fallback_to_cache: "on-error",
    });

    let res: Response;
    try {
      res = await fetch(`${this.endpoint}?${query.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        // Don't let a hung upstream hang the request indefinitely.
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      const reason =
        err instanceof Error && err.name === "TimeoutError"
          ? "the data provider timed out"
          : "could not reach the data provider";
      throw new ProviderError(`Profile lookup failed: ${reason}.`, 504);
    }

    if (!res.ok) {
      throw mapHttpError(res.status);
    }

    let json: ProxycurlProfile;
    try {
      json = (await res.json()) as ProxycurlProfile;
    } catch {
      throw new ProviderError(
        "Received an unreadable response from the data provider.",
        502,
      );
    }

    return mapToProfileData(url, json);
  }
}

/** Translate Proxycurl HTTP errors into user-facing ProviderErrors. */
function mapHttpError(status: number): ProviderError {
  switch (status) {
    case 400:
      return new ProviderError(
        "The data provider rejected that profile URL.",
        400,
      );
    case 401:
    case 403:
      return new ProviderError(
        "The data provider rejected the API key (check PROXYCURL_API_KEY).",
        502,
      );
    case 404:
      return new ProviderError(
        "No public profile was found for that URL.",
        404,
      );
    case 429:
      return new ProviderError(
        "The data provider is rate-limiting or out of credits. Try again later.",
        503,
      );
    default:
      return new ProviderError(
        `The data provider returned an error (HTTP ${status}).`,
        502,
      );
  }
}

/** Map a Proxycurl profile payload to our normalized ProfileData. */
function mapToProfileData(url: string, p: ProxycurlProfile): ProfileData {
  const experiences: Experience[] = (p.experiences ?? [])
    .filter((e): e is ProxycurlExperience => Boolean(e))
    .map((e) => ({
      title: (e.title ?? "").trim(),
      company: (e.company ?? "").trim(),
      durationMonths: monthsBetween(e.starts_at, e.ends_at),
    }))
    // Drop fully-empty rows.
    .filter((e) => e.title || e.company);

  return {
    url,
    name: nullish(p.full_name),
    headline: nullish(p.headline) ?? nullish(p.occupation),
    about: nullish(p.summary),
    experiences,
    followerCount:
      typeof p.follower_count === "number" ? p.follower_count : undefined,
  };
}

const nullish = (s?: string | null): string | undefined => {
  const v = (s ?? "").trim();
  return v.length > 0 ? v : undefined;
};

/**
 * Compute whole months between two Proxycurl dates. A null `ends_at` means the
 * role is current, so we measure to today. Returns undefined if start is
 * unknown or the result is nonsensical.
 */
function monthsBetween(
  start?: ProxycurlDate | null,
  end?: ProxycurlDate | null,
): number | undefined {
  if (!start?.year) return undefined;
  const startMonths = start.year * 12 + ((start.month ?? 1) - 1);

  const now = new Date();
  const endYear = end?.year ?? now.getFullYear();
  const endMonth = end?.year
    ? (end.month ?? 12) - 1
    : now.getMonth(); // current role -> now
  const endMonths = endYear * 12 + endMonth;

  const diff = endMonths - startMonths;
  return diff >= 0 && diff < 1200 ? diff : undefined;
}

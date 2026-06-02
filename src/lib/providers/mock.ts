import type { DataProvider, ProfileData } from "@/lib/types";

/**
 * MockProvider — returns hardcoded fixture data so the app runs with zero API
 * keys in development. The fixture is chosen deterministically from the URL
 * slug so different inputs feel different, but nothing is fetched or stored.
 */
export class MockProvider implements DataProvider {
  async fetchProfile(url: string): Promise<ProfileData> {
    // Tiny artificial delay so the loading state is visible in dev.
    await new Promise((r) => setTimeout(r, 350));

    const slug = extractSlug(url);
    const fixture = pickFixture(slug);
    return { ...fixture, url };
  }
}

function extractSlug(url: string): string {
  const m = url.match(/\/in\/([^/?#]+)/i);
  return (m?.[1] ?? "").toLowerCase();
}

/** Deterministically map a slug to one of the fixtures. */
function pickFixture(slug: string): Omit<ProfileData, "url"> {
  if (slug.includes("legit") || slug.includes("engineer")) return LEGIT;
  if (slug.includes("grift") || slug.includes("guru") || slug.includes("ninja"))
    return GRIFTER;

  // Otherwise hash the slug to a stable index across all fixtures.
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return FIXTURES[h % FIXTURES.length];
}

/** A grounded, low-signal profile. */
const LEGIT: Omit<ProfileData, "url"> = {
  name: "Dana Reyes",
  headline: "Senior Software Engineer at Stripe",
  about:
    "Backend engineer focused on payments reliability. I work on idempotency, " +
    "retries, and observability for high-throughput services. Previously at a " +
    "fintech startup where I built the ledger service.",
  experiences: [
    { title: "Senior Software Engineer", company: "Stripe", durationMonths: 41 },
    { title: "Software Engineer", company: "Plaid", durationMonths: 33 },
    { title: "Software Engineer", company: "Acme Fintech", durationMonths: 28 },
  ],
  followerCount: 1800,
};

/** A high-signal "grifter" profile: buzzwords, title inflation, huge following. */
const GRIFTER: Omit<ProfileData, "url"> = {
  name: "Blake Sterling",
  headline:
    "🚀 Visionary Serial Entrepreneur | Thought Leader | 10x Growth Hacker | " +
    "AI Ninja | Forbes-featured | Helping founders unlock their inner unicorn",
  about:
    "I am a results-driven, passionate disruptor on a mission to revolutionize " +
    "the synergy between web3, AI, and the creator economy. Award-winning. " +
    "World-class. As featured in major publications. DM me 'GROWTH' to 10x your " +
    "revenue overnight with my proprietary framework. The secret nobody tells you.",
  experiences: [
    { title: "Founder & CEO", company: "Stealth Startup", durationMonths: 6 },
    { title: "Chief Visionary Officer", company: "Self-Employed", durationMonths: 5 },
    { title: "Global Head of Growth", company: "Confidential", durationMonths: 4 },
  ],
  followerCount: 240000,
};

/** A middling profile with some signals. */
const MIXED: Omit<ProfileData, "url"> = {
  name: "Sam Okafor",
  headline: "Growth Marketing Leader | Helping brands scale | Ex-FAANG",
  about:
    "Passionate marketer helping companies grow. I love building world-class " +
    "teams and driving results. Always learning, always shipping.",
  experiences: [
    { title: "Head of Growth", company: "ScaleUp Inc", durationMonths: 14 },
    { title: "Marketing Manager", company: "MidCo", durationMonths: 22 },
  ],
  followerCount: 38000,
};

export const FIXTURES: ReadonlyArray<Omit<ProfileData, "url">> = [
  LEGIT,
  MIXED,
  GRIFTER,
];

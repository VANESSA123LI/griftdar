import { describe, it, expect } from "vitest";
import { HeuristicAnalyzer, SIGNALS } from "@/lib/analyzer/heuristic";
import type { ProfileData } from "@/lib/types";

const analyzer = new HeuristicAnalyzer();

const GRIFTER: ProfileData = {
  url: "https://www.linkedin.com/in/grifter",
  name: "Blake Sterling",
  headline:
    "🚀 Visionary Serial Entrepreneur | Thought Leader | 10x Growth Hacker | AI Ninja | Forbes-featured",
  about:
    "Results-driven, passionate disruptor on a mission to revolutionize synergy. " +
    "World-class, award-winning. As featured in major publications. DM me 'GROWTH' " +
    "to 10x your revenue overnight with my proprietary framework. The secret nobody tells you.",
  experiences: [
    { title: "Founder & CEO", company: "Stealth", durationMonths: 6 },
    { title: "Chief Visionary Officer", company: "Self", durationMonths: 5 },
    { title: "Global Head of Growth", company: "Confidential", durationMonths: 4 },
  ],
  followerCount: 240000,
};

const LEGIT: ProfileData = {
  url: "https://www.linkedin.com/in/legit",
  name: "Dana Reyes",
  headline: "Senior Software Engineer at Stripe",
  about:
    "Backend engineer focused on payments reliability. I work on idempotency, " +
    "retries, and observability for high-throughput services. Previously built a ledger service.",
  experiences: [
    { title: "Senior Software Engineer", company: "Stripe", durationMonths: 41 },
    { title: "Software Engineer", company: "Plaid", durationMonths: 33 },
  ],
  followerCount: 1800,
};

describe("HeuristicAnalyzer", () => {
  it("returns a score in 0..100 with all signals", async () => {
    const r = await analyzer.analyze(LEGIT);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.signals).toHaveLength(SIGNALS.length);
  });

  it("scores a grifter profile much higher than a grounded one", async () => {
    const grift = await analyzer.analyze(GRIFTER);
    const legit = await analyzer.analyze(LEGIT);
    expect(grift.score).toBeGreaterThan(legit.score);
    expect(grift.score).toBeGreaterThan(60);
    expect(legit.score).toBeLessThan(35);
  });

  it("emits each signal with a 0..1 value, weight, label and explanation", async () => {
    const r = await analyzer.analyze(GRIFTER);
    for (const s of r.signals) {
      expect(s.value).toBeGreaterThanOrEqual(0);
      expect(s.value).toBeLessThanOrEqual(1);
      expect(s.weight).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.explanation.length).toBeGreaterThan(0);
    }
  });

  it("flags buzzword density on the grifter headline/about", async () => {
    const r = await analyzer.analyze(GRIFTER);
    const buzz = r.signals.find((s) => s.label === "Buzzword density");
    expect(buzz).toBeDefined();
    expect(buzz!.value).toBeGreaterThan(0.5);
  });

  it("flags short tenure in senior titles", async () => {
    const r = await analyzer.analyze(GRIFTER);
    const tenure = r.signals.find((s) => s.label === "Title vs. tenure");
    expect(tenure!.value).toBeGreaterThan(0.8); // all 3 senior roles < 1yr
  });

  it("handles an empty/sparse profile without throwing", async () => {
    const sparse: ProfileData = {
      url: "https://www.linkedin.com/in/sparse",
      experiences: [],
    };
    const r = await analyzer.analyze(sparse);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it("gives a low buzzword value for a clean profile", async () => {
    const r = await analyzer.analyze(LEGIT);
    const buzz = r.signals.find((s) => s.label === "Buzzword density");
    expect(buzz!.value).toBeLessThan(0.3);
  });
});

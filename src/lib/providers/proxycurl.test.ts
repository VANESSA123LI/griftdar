import { describe, it, expect, vi, afterEach } from "vitest";
import { ProxycurlProvider } from "@/lib/providers/proxycurl";
import { ProviderError } from "@/lib/types";

const ENDPOINT = "https://example.test/proxycurl";

function mockFetchOnce(init: { ok: boolean; status?: number; json?: unknown }) {
  const fn = vi.fn().mockResolvedValue({
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    json: async () => init.json ?? {},
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ProxycurlProvider", () => {
  it("throws a clear ProviderError when the API key is missing", () => {
    expect(() => new ProxycurlProvider(undefined, ENDPOINT)).toThrow(
      ProviderError,
    );
  });

  it("sends a Bearer token and the profile URL", async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: { full_name: "X" } });
    const provider = new ProxycurlProvider("test-key", ENDPOINT);
    await provider.fetchProfile("https://www.linkedin.com/in/x");

    const [calledUrl, options] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain(ENDPOINT);
    expect(String(calledUrl)).toContain(
      encodeURIComponent("https://www.linkedin.com/in/x"),
    );
    expect((options.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key",
    );
  });

  it("maps Proxycurl fields into normalized ProfileData", async () => {
    mockFetchOnce({
      ok: true,
      json: {
        full_name: "Jane Doe",
        headline: "Builder of things",
        occupation: "Engineer at Acme",
        summary: "  I build software.  ",
        follower_count: 4200,
        experiences: [
          {
            title: "Senior Engineer",
            company: "Acme",
            starts_at: { year: 2020, month: 1 },
            ends_at: { year: 2022, month: 1 },
          },
          { title: "", company: "", starts_at: null, ends_at: null }, // dropped
        ],
      },
    });
    const provider = new ProxycurlProvider("k", ENDPOINT);
    const profile = await provider.fetchProfile("https://www.linkedin.com/in/jane");

    expect(profile.name).toBe("Jane Doe");
    expect(profile.headline).toBe("Builder of things"); // prefers headline
    expect(profile.about).toBe("I build software."); // trimmed
    expect(profile.followerCount).toBe(4200);
    expect(profile.experiences).toHaveLength(1);
    expect(profile.experiences[0]).toMatchObject({
      title: "Senior Engineer",
      company: "Acme",
      durationMonths: 24,
    });
  });

  it("falls back to occupation when headline is absent", async () => {
    mockFetchOnce({ ok: true, json: { occupation: "Engineer at Acme" } });
    const provider = new ProxycurlProvider("k", ENDPOINT);
    const profile = await provider.fetchProfile("https://www.linkedin.com/in/x");
    expect(profile.headline).toBe("Engineer at Acme");
  });

  it("maps a 404 to a not-found ProviderError", async () => {
    mockFetchOnce({ ok: false, status: 404 });
    const provider = new ProxycurlProvider("k", ENDPOINT);
    await expect(
      provider.fetchProfile("https://www.linkedin.com/in/missing"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("maps a 401 to an auth ProviderError", async () => {
    mockFetchOnce({ ok: false, status: 401 });
    const provider = new ProxycurlProvider("k", ENDPOINT);
    await expect(
      provider.fetchProfile("https://www.linkedin.com/in/x"),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});

import { describe, it, expect } from "vitest";
import { validateLinkedInUrl } from "@/lib/validation";

describe("validateLinkedInUrl", () => {
  it("accepts a canonical profile URL", () => {
    const r = validateLinkedInUrl("https://www.linkedin.com/in/jane-doe");
    expect(r.ok).toBe(true);
    expect(r.slug).toBe("jane-doe");
    expect(r.normalized).toBe("https://www.linkedin.com/in/jane-doe");
  });

  it("accepts a URL without scheme", () => {
    const r = validateLinkedInUrl("linkedin.com/in/jane-doe");
    expect(r.ok).toBe(true);
    expect(r.normalized).toBe("https://www.linkedin.com/in/jane-doe");
  });

  it("accepts a country-locale subdomain and strips query/trailing slash", () => {
    const r = validateLinkedInUrl(
      "https://uk.linkedin.com/in/jane-doe/?originalSubdomain=uk",
    );
    expect(r.ok).toBe(true);
    expect(r.slug).toBe("jane-doe");
    expect(r.normalized).toBe("https://www.linkedin.com/in/jane-doe");
  });

  it("is case-insensitive on host and the /in/ segment", () => {
    const r = validateLinkedInUrl("HTTPS://WWW.LINKEDIN.COM/IN/Jane-Doe");
    expect(r.ok).toBe(true);
    expect(r.slug).toBe("Jane-Doe");
  });

  it("decodes percent-encoded slugs", () => {
    const r = validateLinkedInUrl("https://www.linkedin.com/in/jos%C3%A9");
    expect(r.ok).toBe(true);
    expect(r.slug).toBe("josé");
  });

  it("rejects empty input", () => {
    expect(validateLinkedInUrl("").ok).toBe(false);
    expect(validateLinkedInUrl("   ").ok).toBe(false);
  });

  it("rejects non-linkedin hosts", () => {
    expect(validateLinkedInUrl("https://example.com/in/jane-doe").ok).toBe(false);
    // Guard against suffix-spoofing hosts.
    expect(validateLinkedInUrl("https://linkedin.com.evil.com/in/x").ok).toBe(
      false,
    );
    expect(validateLinkedInUrl("https://notlinkedin.com/in/x").ok).toBe(false);
  });

  it("rejects company / school / posts pages", () => {
    expect(validateLinkedInUrl("https://www.linkedin.com/company/acme").ok).toBe(
      false,
    );
    expect(validateLinkedInUrl("https://www.linkedin.com/school/mit").ok).toBe(
      false,
    );
    expect(
      validateLinkedInUrl("https://www.linkedin.com/posts/jane_activity").ok,
    ).toBe(false);
  });

  it("rejects /in/ with no slug", () => {
    expect(validateLinkedInUrl("https://www.linkedin.com/in/").ok).toBe(false);
    expect(validateLinkedInUrl("https://www.linkedin.com/in").ok).toBe(false);
  });

  it("rejects garbage that isn't a URL", () => {
    expect(validateLinkedInUrl("not a url at all").ok).toBe(false);
  });
});

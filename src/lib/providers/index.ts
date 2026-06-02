import type { DataProvider } from "@/lib/types";
import { MockProvider } from "@/lib/providers/mock";

/**
 * Selects the active DataProvider based on the DATA_PROVIDER env var.
 *   - "mock" (default): MockProvider, no API keys required.
 *   - "api":            ProxycurlProvider, requires PROXYCURL_API_KEY.
 *
 * The "api" implementation is added in a later step; until then we fall back
 * to mock and log a warning so the app never hard-crashes on misconfig.
 */
export async function getProvider(): Promise<DataProvider> {
  const choice = (process.env.DATA_PROVIDER ?? "mock").toLowerCase();

  if (choice === "api") {
    const { ProxycurlProvider } = await import("@/lib/providers/proxycurl");
    return new ProxycurlProvider();
  }

  return new MockProvider();
}

import { type DataProvider, type ProfileData, ProviderError } from "@/lib/types";

/**
 * ProxycurlProvider — calls the Proxycurl LinkedIn data API.
 *
 * STUB: full implementation lands in build step 5. Kept as a typed placeholder
 * so the provider selector compiles and the env toggle is wired end-to-end.
 */
export class ProxycurlProvider implements DataProvider {
  async fetchProfile(_url: string): Promise<ProfileData> {
    throw new ProviderError(
      "ApiProvider (Proxycurl) is not implemented yet — set DATA_PROVIDER=mock.",
      501,
    );
  }
}

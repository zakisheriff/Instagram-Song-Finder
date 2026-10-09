import { readJson, request } from "@/lib/http/request";

/** What Apple's public lookup service reports for one song. It has no ISRC. */
export interface AppleTrack {
  title: string;
  artist: string;
  durationMs: number | null;
}

interface LookupResponse {
  results?: Array<{
    wrapperType?: string;
    kind?: string;
    trackName?: string;
    artistName?: string;
    trackTimeMillis?: number;
  }>;
}

export interface AppleLookupDeps {
  fetchImpl?: typeof fetch;
}

/**
 * Looks up a song by its Apple Music id using Apple's public iTunes Lookup
 * service. Returns `null` when Apple has no such song.
 */
export async function lookupAppleTrack(
  trackId: string,
  country: string,
  deps: AppleLookupDeps = {},
): Promise<AppleTrack | null> {
  if (!/^\d{1,20}$/.test(trackId) || !/^[a-z]{2}$/.test(country)) return null;
  const params = new URLSearchParams({ id: trackId, country, entity: "song" });
  const response = await request(`https://itunes.apple.com/lookup?${params}`, {
    headers: { Accept: "application/json" },
    retries: 1,
    fetchImpl: deps.fetchImpl,
  });
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  const body = await readJson<LookupResponse>(response);
  const song = body.results?.find((result) => result.kind === "song" && result.trackName);
  if (!song?.trackName) return null;
  return {
    title: song.trackName,
    artist: song.artistName ?? "",
    durationMs: typeof song.trackTimeMillis === "number" ? song.trackTimeMillis : null,
  };
}

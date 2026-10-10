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

/**
 * Searches Apple's public catalog for songs. It lists new releases straight
 * away, so it can name the artist of a song another catalog can't search for
 * yet. Returns `null` when Apple can't be asked, so a failure isn't mistaken for "no such song".
 */
export async function searchAppleSongs(term: string, deps: AppleLookupDeps = {}): Promise<AppleTrack[] | null> {
  const params = new URLSearchParams({ term: term.slice(0, 150), entity: "song", limit: "5" });
  try {
    const response = await request(`https://itunes.apple.com/search?${params}`, {
      headers: { Accept: "application/json" },
      retries: 0,
      timeoutMs: 4000,
      fetchImpl: deps.fetchImpl,
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const body = await readJson<LookupResponse>(response);
    return (body.results ?? [])
      .filter((result) => result.kind === "song" && result.trackName)
      .map((result) => ({
        title: result.trackName ?? "",
        artist: result.artistName ?? "",
        durationMs: typeof result.trackTimeMillis === "number" ? result.trackTimeMillis : null,
      }));
  } catch {
    return null;
  }
}

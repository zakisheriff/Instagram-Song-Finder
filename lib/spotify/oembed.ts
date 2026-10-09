import { readJson, request } from "@/lib/http/request";

export interface SpotifyTitleDeps {
  fetchImpl?: typeof fetch;
}

/**
 * Reads a track's title from Spotify's public oEmbed endpoint, which needs no
 * credentials. It reports the title only (no artist, length or ISRC), so it is
 * used solely to turn a Spotify link into a title search when the Web API
 * cannot be reached. Returns `null` on any failure.
 */
export async function fetchSpotifyTitle(
  trackId: string,
  deps: SpotifyTitleDeps = {},
): Promise<string | null> {
  if (!/^[A-Za-z0-9]{22}$/.test(trackId)) return null;
  const params = new URLSearchParams({ url: `https://open.spotify.com/track/${trackId}` });
  try {
    const response = await request(`https://open.spotify.com/oembed?${params}`, {
      headers: { Accept: "application/json" },
      retries: 0,
      timeoutMs: 4000,
      fetchImpl: deps.fetchImpl,
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const body = await readJson<{ title?: unknown }>(response);
    return typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
  } catch {
    return null;
  }
}

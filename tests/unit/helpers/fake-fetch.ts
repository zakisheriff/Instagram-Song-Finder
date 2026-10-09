import { vi } from "vitest";

type Responder = (url: URL, init: RequestInit) => Response | Promise<Response>;

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/**
 * A `fetch` stand-in routed by URL prefix. Each route answers with a fixed
 * responder or a queue of responders consumed one call at a time.
 */
export function fakeFetch(routes: Record<string, Responder | Responder[]>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    calls.push({ url: url.toString(), init });
    const key = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((prefix) => url.toString().startsWith(prefix));
    if (!key) throw new Error(`Unexpected fetch: ${url}`);
    const route = routes[key];
    const responder = Array.isArray(route) ? (route.length > 1 ? route.shift()! : route[0]) : route;
    return responder(url, init);
  });
  return { fetchImpl: impl as unknown as typeof fetch, calls };
}

export const noSleep = () => Promise.resolve();

export const TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API = "https://api.spotify.com/v1";
export const DEEZER_API = "https://api.deezer.com";

export const tokenOk = () => json({ access_token: "token-1", token_type: "Bearer", expires_in: 3600 });

export function spotifyTrack(overrides: Record<string, unknown> = {}) {
  return {
    id: "2plbrEY59IikOBgBGLjaoe",
    type: "track",
    name: "Die With A Smile",
    explicit: false,
    duration_ms: 251667,
    external_ids: { isrc: "USUM72409273" },
    external_urls: { spotify: "https://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe" },
    artists: [{ name: "Lady Gaga" }, { name: "Bruno Mars" }],
    album: {
      name: "Die With A Smile",
      release_date: "2024-08-16",
      images: [
        { url: "https://i.scdn.co/image/large", width: 640, height: 640 },
        { url: "https://i.scdn.co/image/medium", width: 300, height: 300 },
        { url: "https://i.scdn.co/image/small", width: 64, height: 64 },
      ],
    },
    ...overrides,
  };
}

export function spotifySearch(items: unknown[], extra: Record<string, unknown> = {}) {
  return json({ tracks: { items, total: items.length, offset: 0, next: null, ...extra } });
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/lib/cache/ttl-cache";
import type { SearchApiResponse } from "@/lib/api/contract";
import { handleSearch, handleTrack, type HandlerDeps } from "@/lib/api/handlers";
import { MusicError } from "@/lib/music/errors";
import type { MusicProvider } from "@/lib/music/types";
import { clientKey, RateLimiter } from "@/lib/rate-limit";
import { page, stubProvider, track } from "./helpers/stub-provider";

const ID = "2plbrEY59IikOBgBGLjaoe";
const BASE = "https://instagramsongfinder.theatom.lk";

let logger: { error: ReturnType<typeof vi.fn<(...args: unknown[]) => void>> };

function deps(providers: MusicProvider[], overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    getProviders: () => providers,
    limiter: new RateLimiter({ limit: 100, windowMs: 60_000 }),
    cache: new TtlCache<unknown>(),
    fetchSpotifyTitle: async () => null,
    lookupAppleTrack: async () => null,
    fetchLinkTitle: async () => null,
    logger,
    ...overrides,
  };
}

const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`${BASE}${path}`, { headers });

async function body(response: Response): Promise<SearchApiResponse> {
  return (await response.json()) as SearchApiResponse;
}

beforeEach(() => {
  logger = { error: vi.fn<(...args: unknown[]) => void>() };
});

describe("GET /api/search", () => {
  it("returns typed results with shared-cache headers and no indexing", async () => {
    const spotify = stubProvider("spotify", { searchTracks: vi.fn(async () => page([track()], 10)) });
    const response = await handleSearch(get("/api/search?q=die%20with%20a%20smile"), deps([spotify]));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await body(response)).toMatchObject({
      ok: true,
      kind: "text",
      provider: { id: "spotify", name: "Spotify" },
      nextOffset: 10,
      tracks: [{ title: "Die With A Smile", isrc: "USUM72409273" }],
    });
  });

  it("handles a Spotify link, a URI and an ISRC through the same endpoint", async () => {
    const spotify = stubProvider("spotify", {
      getTrack: vi.fn(async () => track()),
      findByIsrc: vi.fn(async () => [track()]),
    });
    const shared = deps([spotify]);
    const link = await handleSearch(
      get(`/api/search?q=${encodeURIComponent(`https://open.spotify.com/track/${ID}?si=1`)}`),
      shared,
    );
    expect(await body(link)).toMatchObject({ ok: true, kind: "spotify-track" });
    const uri = await handleSearch(get(`/api/search?q=spotify:track:${ID}`), shared);
    expect(await body(uri)).toMatchObject({ ok: true, kind: "spotify-track" });
    const isrc = await handleSearch(get("/api/search?q=isrc:USUM72409273"), shared);
    expect(await body(isrc)).toMatchObject({ ok: true, kind: "isrc", query: "USUM72409273" });
  });

  it.each([
    ["/api/search", 400],
    ["/api/search?q=", 400],
    ["/api/search?q=a", 400],
    ["/api/search?q=isrc:123", 400],
    ["/api/search?q=hello&offset=-1", 400],
    ["/api/search?q=hello&offset=abc", 400],
    ["/api/search?q=hello&provider=napster", 400],
    [`/api/search?q=${encodeURIComponent("https://evil.example/track/x")}`, 400],
  ])("rejects %s with %i and never caches the error", async (path, status) => {
    const spotify = stubProvider("spotify");
    const response = await handleSearch(get(path), deps([spotify]));
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await body(response)).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
    expect(spotify.searchTracks).not.toHaveBeenCalled();
  });

  it("maps provider failures to honest status codes without leaking details", async () => {
    const failing = (error: unknown) =>
      stubProvider("spotify", {
        searchTracks: vi.fn(async () => {
          throw error;
        }),
      });

    const limited = await handleSearch(
      get("/api/search?q=bad%20guy"),
      deps([failing(new MusicError("RATE_LIMITED", "upstream", { retryAfterSeconds: 17 }))]),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("17");

    const auth = await handleSearch(
      get("/api/search?q=bad%20guy"),
      deps([failing(new MusicError("PROVIDER_AUTH", "Spotify token request failed (400)"))]),
    );
    expect(auth.status).toBe(502);
    expect(JSON.stringify(await body(auth))).not.toContain("token request");

    const timeout = await handleSearch(
      get("/api/search?q=bad%20guy"),
      deps([failing(new MusicError("PROVIDER_TIMEOUT"))]),
    );
    expect(timeout.status).toBe(504);

    const crash = await handleSearch(
      get("/api/search?q=bad%20guy"),
      deps([failing(new Error("secret stack detail"))]),
    );
    expect(crash.status).toBe(500);
    expect(JSON.stringify(await body(crash))).not.toContain("secret stack detail");
    expect(logger.error).toHaveBeenCalled();
  });

  it("answers 404 for an unknown ISRC and 503 when Spotify links can't be served", async () => {
    const unknown = await handleSearch(get("/api/search?q=USUM72409273"), deps([stubProvider("spotify")]));
    expect(unknown.status).toBe(404);

    const unconfigured = stubProvider("spotify", { isConfigured: vi.fn(() => false) });
    const response = await handleSearch(
      get(`/api/search?q=spotify:track:${ID}`),
      deps([unconfigured, stubProvider("deezer")]),
    );
    expect(response.status).toBe(503);
    expect(await body(response)).toMatchObject({ error: { code: "NOT_CONFIGURED" } });
  });

  it("rate limits each client separately", async () => {
    const spotify = stubProvider("spotify", { searchTracks: vi.fn(async () => page([track()])) });
    const shared = deps([spotify], { limiter: new RateLimiter({ limit: 2, windowMs: 60_000 }) });
    const from = (ip: string) => handleSearch(get("/api/search?q=bad%20guy", { "x-forwarded-for": ip }), shared);

    expect((await from("203.0.113.1")).status).toBe(200);
    expect((await from("203.0.113.1")).status).toBe(200);
    const blocked = await from("203.0.113.1");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await body(blocked)).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect((await from("203.0.113.2")).status).toBe(200);
  });
});

describe("GET /api/track", () => {
  it("looks up the exact recording for a Spotify link", async () => {
    const spotify = stubProvider("spotify", { getTrack: vi.fn(async () => track()) });
    const response = await handleTrack(
      get(`/api/track?url=${encodeURIComponent(`https://open.spotify.com/track/${ID}?si=zz`)}`),
      deps([spotify]),
    );
    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({ ok: true, kind: "spotify-track", tracks: [{ isrc: "USUM72409273" }] });
    expect(spotify.getTrack).toHaveBeenCalledWith(ID);
  });

  it("looks up recordings by ISRC", async () => {
    const spotify = stubProvider("spotify", { findByIsrc: vi.fn(async () => [track()]) });
    const response = await handleTrack(get("/api/track?isrc=isrc:us-um7-24-09273"), deps([spotify]));
    expect(await body(response)).toMatchObject({ ok: true, kind: "isrc", query: "USUM72409273" });
  });

  it.each([
    "/api/track",
    "/api/track?url=die%20with%20a%20smile",
    "/api/track?isrc=12345",
    `/api/track?url=spotify:track:${ID}&isrc=USUM72409273`,
    `/api/track?url=${encodeURIComponent("http://169.254.169.254/latest")}`,
    `/api/track?url=${encodeURIComponent("https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy")}`,
  ])("rejects %s", async (path) => {
    const spotify = stubProvider("spotify");
    const response = await handleTrack(get(path), deps([spotify]));
    expect(response.status).toBe(400);
    expect(spotify.getTrack).not.toHaveBeenCalled();
  });
});

describe("RateLimiter", () => {
  it("resets after the window and bounds its memory", () => {
    let now = 0;
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000, maxKeys: 3, now: () => now });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a")).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
    now = 1001;
    expect(limiter.check("a").allowed).toBe(true);
    for (const key of ["b", "c", "d", "e", "f"]) limiter.check(key);
    expect(limiter.check("z").allowed).toBe(true);
  });

  it("derives the client key from proxy headers", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientKey(new Headers({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});

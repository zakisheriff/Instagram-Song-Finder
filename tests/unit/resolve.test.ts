import { beforeEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/lib/cache/ttl-cache";
import { MusicError } from "@/lib/music/errors";
import { resolveQuery } from "@/lib/search/resolve";
import { editDistance, relaxedQueries, tokenize, trackSimilarity } from "@/lib/search/similarity";
import { page, stubProvider, track } from "./helpers/stub-provider";

const ID = "2plbrEY59IikOBgBGLjaoe";
let cache: TtlCache<unknown>;

beforeEach(() => {
  cache = new TtlCache<unknown>();
});

describe("resolveQuery: text", () => {
  it.each(["Die With A Smile", "Lady Gaga", "Die With A Smile Lady Gaga", "die wi"])(
    "searches the primary provider for %j",
    async (query) => {
      const spotify = stubProvider("spotify", { searchTracks: vi.fn(async () => page([track()], 10)) });
      const result = await resolveQuery(query, { providers: [spotify], cache });
      expect(result).toMatchObject({
        kind: "text",
        query,
        provider: { id: "spotify" },
        nextOffset: 10,
      });
      expect(spotify.searchTracks).toHaveBeenCalledWith(query, { offset: 0 });
    },
  );

  it("returns every matching recording without merging look-alikes", async () => {
    const versions = [
      track(),
      track({ id: "spotify:live", title: "Die With A Smile (Live)", isrc: "USUM72500001", versionTags: ["Live"] }),
      track({ id: "spotify:sped", title: "Die With A Smile (Sped Up)", isrc: null, versionTags: ["Sped up"] }),
    ];
    const spotify = stubProvider("spotify", { searchTracks: vi.fn(async () => page(versions)) });
    const result = await resolveQuery("die with a smile", { providers: [spotify], cache });
    expect(result.tracks.map((item) => item.isrc)).toEqual(["USUM72409273", "USUM72500001", null]);
  });

  it("falls back to the next provider when the first is rate limited", async () => {
    const spotify = stubProvider("spotify", {
      searchTracks: vi.fn(async () => {
        throw new MusicError("RATE_LIMITED");
      }),
    });
    const deezer = stubProvider("deezer", {
      searchTracks: vi.fn(async () => page([track({ id: "deezer:1", provider: "deezer" })])),
    });
    const result = await resolveQuery("bad guy", { providers: [spotify, deezer], cache });
    expect(result.provider.id).toBe("deezer");
  });

  it("skips providers that are not configured", async () => {
    const spotify = stubProvider("spotify", { isConfigured: vi.fn(() => false) });
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([track()])) });
    const result = await resolveQuery("bad guy", { providers: [spotify, deezer], cache });
    expect(result.provider.id).toBe("deezer");
    expect(spotify.searchTracks).not.toHaveBeenCalled();
  });

  it("surfaces the provider failure when nothing can answer", async () => {
    const spotify = stubProvider("spotify", {
      searchTracks: vi.fn(async () => {
        throw new MusicError("RATE_LIMITED", undefined, { retryAfterSeconds: 12 });
      }),
    });
    await expect(resolveQuery("bad guy", { providers: [spotify], cache })).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 12,
    });
  });

  it("reports NOT_CONFIGURED when no provider is available at all", async () => {
    const spotify = stubProvider("spotify", { isConfigured: vi.fn(() => false) });
    await expect(resolveQuery("bad guy", { providers: [spotify], cache })).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
  });

  it("returns an empty list, not an error, when nothing matches", async () => {
    const result = await resolveQuery("zzzzqqqq", { providers: [stubProvider("spotify")], cache });
    expect(result.tracks).toEqual([]);
  });

  it("keeps pagination on the provider that served the first page", async () => {
    const spotify = stubProvider("spotify");
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([track()])) });
    await resolveQuery("bad guy", { providers: [spotify, deezer], offset: 10, provider: "deezer", cache });
    expect(spotify.searchTracks).not.toHaveBeenCalled();
    expect(deezer.searchTracks).toHaveBeenCalledWith("bad guy", { offset: 10 });
  });

  it("rejects empty, too-short and malformed input with a helpful message", async () => {
    const providers = [stubProvider("spotify")];
    await expect(resolveQuery("  ", { providers, cache })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(resolveQuery("a", { providers, cache })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(resolveQuery("isrc:nope", { providers, cache })).rejects.toMatchObject({
      code: "INVALID_INPUT",
      publicMessage: expect.stringContaining("valid ISRC"),
    });
    await expect(
      resolveQuery("https://open.spotify.com/track/bad", { providers, cache }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", publicMessage: expect.stringContaining("Spotify link") });
    expect(providers[0].searchTracks).not.toHaveBeenCalled();
  });

  it("deduplicates identical concurrent lookups and caches the result", async () => {
    const spotify = stubProvider("spotify", { searchTracks: vi.fn(async () => page([track()])) });
    const options = { providers: [spotify], cache };
    await Promise.all([resolveQuery("Bad Guy", options), resolveQuery("bad guy", options)]);
    await resolveQuery("BAD GUY", options);
    expect(spotify.searchTracks).toHaveBeenCalledTimes(1);
  });
});

describe("resolveQuery: typo tolerance", () => {
  const junk = track({ id: "spotify:junk", title: "Smiling Faces", artists: ["Someone Else"], album: "Other" });

  it("keeps the preferred catalog when its results match what was typed", async () => {
    const spotify = stubProvider("spotify", { searchTracks: vi.fn(async () => page([track()])) });
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([track({ provider: "deezer" })])) });
    const result = await resolveQuery("die with a smile", { providers: [spotify, deezer], cache });
    expect(result.provider.id).toBe("spotify");
    expect(deezer.searchTracks).not.toHaveBeenCalled();
  });

  it("switches catalog when a misspelled query matches better elsewhere", async () => {
    const spotify = stubProvider("spotify", { searchTracks: vi.fn(async () => page([junk])) });
    const deezer = stubProvider("deezer", {
      searchTracks: vi.fn(async () => page([track({ id: "deezer:1", provider: "deezer" })])),
    });
    const result = await resolveQuery("die wth a smlie ldy gaga", { providers: [spotify, deezer], cache });
    expect(result.provider.id).toBe("deezer");
    expect(result.tracks[0].title).toBe("Die With A Smile");
    expect(result.approximate).toBeUndefined();
  });

  it("stays with the preferred catalog when the other is no better", async () => {
    const spotify = stubProvider("spotify", { searchTracks: vi.fn(async () => page([junk])) });
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([junk])) });
    const result = await resolveQuery("completely different words", { providers: [spotify, deezer], cache });
    expect(result.provider.id).toBe("spotify");
  });

  it("retries without one word when nothing matches, and says the result is approximate", async () => {
    const searchTracks = vi.fn(async (query: string) =>
      query === "die with a smile" ? page([track()]) : page([]),
    );
    const spotify = stubProvider("spotify", { searchTracks });
    const result = await resolveQuery("die with a smile xqzv", { providers: [spotify], cache });
    expect(result).toMatchObject({ approximate: true, query: "die with a smile" });
    expect(result.tracks).toHaveLength(1);
  });
});

describe("similarity helpers", () => {
  it("scores typos highly and unrelated text low", () => {
    expect(trackSimilarity("die wth a smlie", track())).toBeGreaterThan(0.75);
    expect(trackSimilarity("ldy gaga bruno mrs", track())).toBeGreaterThan(0.75);
    expect(trackSimilarity("die wi", track())).toBeGreaterThan(0.6);
    expect(trackSimilarity("Béyoncé hälo", track({ title: "Halo", artists: ["Beyonce"] }))).toBe(1);
    expect(trackSimilarity("thunderstruck acdc", track())).toBeLessThan(0.5);
  });

  it("computes edit distance and tokens", () => {
    expect(editDistance("smlie", "smile")).toBe(2);
    expect(editDistance("", "abc")).toBe(3);
    expect(tokenize("  Don't Stop (Me) Now! ")).toEqual(["don", "t", "stop", "me", "now"]);
  });

  it("builds looser queries by leaving out one word at a time", () => {
    expect(relaxedQueries("one")).toEqual([]);
    const variants = relaxedQueries("die with a smile xqzv");
    expect(variants).toContain("die with a smile");
    expect(variants.length).toBeLessThanOrEqual(4);
  });
});

describe("resolveQuery: ISRC", () => {
  it.each(["USUM72409273", "isrc:USUM72409273", "us-um7-24-09273"])("looks up %j", async (query) => {
    const spotify = stubProvider("spotify", { findByIsrc: vi.fn(async () => [track()]) });
    const result = await resolveQuery(query, { providers: [spotify], cache });
    expect(result).toMatchObject({ kind: "isrc", query: "USUM72409273", total: 1 });
    expect(spotify.findByIsrc).toHaveBeenCalledWith("USUM72409273");
  });

  it("tries the fallback provider when the primary has no such recording", async () => {
    const spotify = stubProvider("spotify");
    const deezer = stubProvider("deezer", { findByIsrc: vi.fn(async () => [track({ provider: "deezer" })]) });
    const result = await resolveQuery("USUM72409273", { providers: [spotify, deezer], cache });
    expect(result.provider.id).toBe("deezer");
  });

  it("answers NOT_FOUND when no catalog lists the code", async () => {
    await expect(
      resolveQuery("USUM72409273", { providers: [stubProvider("spotify"), stubProvider("deezer")], cache }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", publicMessage: expect.stringContaining("USUM72409273") });
  });
});

describe("resolveQuery: Spotify links", () => {
  it.each([
    `https://open.spotify.com/track/${ID}`,
    `https://open.spotify.com/track/${ID}?si=abc&utm_source=copy-link`,
    `spotify:track:${ID}`,
  ])("looks up the exact track for %j", async (query) => {
    const spotify = stubProvider("spotify", { getTrack: vi.fn(async () => track()) });
    const result = await resolveQuery(query, { providers: [spotify], cache });
    expect(result).toMatchObject({ kind: "spotify-track", query: ID, tracks: [{ isrc: "USUM72409273" }] });
    expect(spotify.getTrack).toHaveBeenCalledWith(ID);
    expect(spotify.searchTracks).not.toHaveBeenCalled();
  });

  it("resolves a share link first, then looks up the track", async () => {
    const spotify = stubProvider("spotify", { getTrack: vi.fn(async () => track()) });
    const resolveShortLink = vi.fn(async () => ID);
    const result = await resolveQuery("https://spotify.link/AbCd123?si=1", {
      providers: [spotify],
      resolveShortLink,
      cache,
    });
    expect(resolveShortLink).toHaveBeenCalledWith("https://spotify.link/AbCd123");
    expect(result.tracks).toHaveLength(1);
  });

  it("passes on a share link that cannot be resolved safely", async () => {
    const spotify = stubProvider("spotify");
    const resolveShortLink = vi.fn(async () => {
      throw new MusicError("UNRESOLVABLE_LINK");
    });
    await expect(
      resolveQuery("https://spotify.link/AbCd123", { providers: [spotify], resolveShortLink, cache }),
    ).rejects.toMatchObject({ code: "UNRESOLVABLE_LINK", publicMessage: expect.stringContaining("full open.spotify.com") });
    expect(spotify.getTrack).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for a track Spotify doesn't have", async () => {
    await expect(
      resolveQuery(`spotify:track:${ID}`, { providers: [stubProvider("spotify")], cache }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is honest when Spotify isn't configured instead of guessing a match", async () => {
    const spotify = stubProvider("spotify", { isConfigured: vi.fn(() => false) });
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([track()])) });
    await expect(
      resolveQuery(`https://open.spotify.com/track/${ID}`, { providers: [spotify, deezer], cache }),
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED", publicMessage: expect.stringContaining("Spotify links") });
    expect(deezer.searchTracks).not.toHaveBeenCalled();
  });

  it("points to title search when Spotify itself refuses a link lookup", async () => {
    const spotify = stubProvider("spotify", {
      getTrack: vi.fn(async () => {
        throw new MusicError("PROVIDER_AUTH", "Spotify refused the request (403)");
      }),
    });
    await expect(
      resolveQuery(`spotify:track:${ID}`, { providers: [spotify, stubProvider("deezer")], cache }),
    ).rejects.toMatchObject({ code: "PROVIDER_AUTH", publicMessage: expect.stringContaining("Search by song title") });
  });

  it("shows a track whose ISRC is missing rather than failing", async () => {
    const spotify = stubProvider("spotify", { getTrack: vi.fn(async () => track({ isrc: null })) });
    const result = await resolveQuery(`spotify:track:${ID}`, { providers: [spotify], cache });
    expect(result.tracks[0].isrc).toBeNull();
  });
});

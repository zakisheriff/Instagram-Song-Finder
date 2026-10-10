import { beforeEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/lib/cache/ttl-cache";
import { MusicError } from "@/lib/music/errors";
import { linkTitleToSearch } from "@/lib/links/title";
import { resolveQuery } from "@/lib/search/resolve";
import { editDistance, relaxedQueries, tokenize, trackSimilarity } from "@/lib/search/similarity";
import { page, stubProvider, track } from "./helpers/stub-provider";

const ID = "2plbrEY59IikOBgBGLjaoe";
let cache: TtlCache<unknown>;
/** Stand-ins for the public Spotify title and Apple lookups, so tests never touch the network. */
const noTitle = async () => null;
const noApple = async () => null;

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

describe("resolveQuery: links without Spotify access", () => {
  const deezerTrack = track({ id: "deezer:9", provider: "deezer", title: "Magale (From \"Baththa\")", artists: ["Sai Abhyankkar"], durationMs: 257_000, isrc: "INT202607391" });

  it("turns a Spotify link into a title search when Spotify refuses the lookup", async () => {
    const spotify = stubProvider("spotify", {
      getTrack: vi.fn(async () => {
        throw new MusicError("PROVIDER_AUTH", "Spotify refused the request (403)");
      }),
    });
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([deezerTrack])) });
    const fetchSpotifyTitle = vi.fn(async () => 'Magale - From "Baththa"');

    const result = await resolveQuery(`https://open.spotify.com/track/${ID}?si=1`, {
      providers: [spotify, deezer],
      cache,
      fetchSpotifyTitle,
    });
    expect(fetchSpotifyTitle).toHaveBeenCalledWith(ID);
    expect(result).toMatchObject({ kind: "text", provider: { id: "deezer" }, tracks: [{ isrc: "INT202607391" }] });
    // It is presented as possible matches, not as the exact track.
    expect(result.notice).toContain("couldn't confirm this exact track");
  });

  it("does the same when Spotify isn't configured at all", async () => {
    const spotify = stubProvider("spotify", { isConfigured: vi.fn(() => false) });
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([deezerTrack])) });
    const result = await resolveQuery(`spotify:track:${ID}`, {
      providers: [spotify, deezer],
      cache,
      fetchSpotifyTitle: async () => "Magale",
    });
    expect(result.tracks).toHaveLength(1);
    expect(result.notice).toBeDefined();
  });

  it("matches an Apple Music link by title, artist and length", async () => {
    const other = track({ id: "deezer:10", provider: "deezer", title: "Magale (Slowed + Reverb) Baththa", durationMs: 293_000, isrc: "QT9XG2630633" });
    const cover = track({ id: "deezer:11", provider: "deezer", title: "Chellame Magale", durationMs: 256_000, isrc: "INT202607426" });
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([deezerTrack, cover, other])) });
    const lookupAppleTrack = vi.fn(async () => ({
      title: 'Magale (From "Baththa")',
      artist: "Sai Abhyankkar, Harini & Karthik Netha",
      durationMs: 257_813,
    }));

    const result = await resolveQuery(
      "https://music.apple.com/lk/album/magale-from-baththa/6810160390?i=6810160531",
      { providers: [deezer], cache, lookupAppleTrack },
    );
    expect(lookupAppleTrack).toHaveBeenCalledWith("6810160531", "lk");
    expect(deezer.searchTracks).toHaveBeenCalledWith('Magale (From "Baththa") Sai Abhyankkar', { offset: 0 });
    expect(result).toMatchObject({ kind: "link-match", total: 1, tracks: [{ isrc: "INT202607391" }] });
    expect(result.notice).toContain("Apple Music");
    expect(result.approximate).toBeUndefined();
  });

  it("shows the closest results, marked approximate, when nothing matches an Apple Music link", async () => {
    const wrongLength = track({ id: "deezer:12", provider: "deezer", title: "Magale (Live)", durationMs: 400_000 });
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([wrongLength])) });
    const result = await resolveQuery("https://music.apple.com/us/song/magale/6810160531", {
      providers: [deezer],
      cache,
      lookupAppleTrack: async () => ({ title: "Magale", artist: "Sai Abhyankkar", durationMs: 257_813 }),
    });
    expect(result).toMatchObject({ kind: "link-match", approximate: true });
    expect(result.notice).toContain("No exact match");
  });

  it("answers NOT_FOUND when Apple doesn't know the song", async () => {
    await expect(
      resolveQuery("https://music.apple.com/us/song/x/1", {
        providers: [stubProvider("deezer")],
        cache,
        lookupAppleTrack: noApple,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("resolveQuery: links from other services", () => {
  it("returns the exact recording for a Deezer link", async () => {
    const deezer = stubProvider("deezer", { getTrack: vi.fn(async () => track({ provider: "deezer" })) });
    const result = await resolveQuery("https://www.deezer.com/us/track/2947516331", { providers: [deezer], cache });
    expect(deezer.getTrack).toHaveBeenCalledWith("2947516331");
    expect(result).toMatchObject({ kind: "link-match", total: 1, notice: "Exact match for your Deezer link" });
  });

  it("turns a YouTube link into a search for the cleaned-up title", async () => {
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([track({ provider: "deezer" })])) });
    const fetchLinkTitle = vi.fn(async () => ({
      title: "Lady Gaga, Bruno Mars - Die With A Smile (Official Music Video)",
      author: "LadyGagaVEVO",
    }));
    const result = await resolveQuery("https://youtu.be/kPa7bsKwL-c?si=1", { providers: [deezer], cache, fetchLinkTitle });
    expect(fetchLinkTitle).toHaveBeenCalledWith("youtube", "https://www.youtube.com/watch?v=kPa7bsKwL-c");
    expect(deezer.searchTracks).toHaveBeenCalledWith("Lady Gaga, Bruno Mars - Die With A Smile", { offset: 0 });
    expect(result).toMatchObject({ kind: "link-match", notice: "From your YouTube link. Select the correct recording" });
  });

  it("searches a YouTube Music title without the credits that hide the song", async () => {
    const radhimaa = track({ provider: "deezer", title: 'Radhimaa (From "Think Indie")', artists: ["Sai Abhyankkar"], album: null });
    const other = track({ provider: "deezer", id: "deezer:2", title: 'Aasa Kooda (From "Think Indie")', artists: ["Sai Abhyankkar"], album: null });
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([other, radhimaa])) });
    const result = await resolveQuery("https://music.youtube.com/watch?v=BmRX2g6-iQI&si=x", {
      providers: [deezer],
      cache,
      fetchLinkTitle: async () => ({ title: 'Radhimaa (feat. Sai Smriti) [From "Think Indie"]', author: "Sai Abhyankkar - Topic" }),
    });
    expect(deezer.searchTracks).toHaveBeenCalledWith("Radhimaa Sai Abhyankkar", { offset: 0 });
    expect(result.tracks.map((item) => item.title)).toEqual(['Radhimaa (From "Think Indie")']);
  });

  it("drops the uploader when a label's channel isn't the artist", async () => {
    const song = track({ provider: "deezer", title: 'Aathi Iva Yarraa (From "Scene")', artists: ["Sushin Shyam"], album: null });
    const searchTracks = vi.fn(async (query: string) => page(query === "Aathi Iva Yarraa" ? [song] : []));
    const deezer = stubProvider("deezer", { searchTracks });
    const result = await resolveQuery("https://youtu.be/bN1t-9ZH-uU", {
      providers: [deezer],
      cache,
      fetchLinkTitle: async () => ({
        title: "Aathi Iva Yarraa Lyric | SCENE | Suriya | Nazriya Nazim | Sushin Shyam",
        author: "Sony Music South",
      }),
    });
    expect(searchTracks.mock.calls.map(([query]) => query)).toEqual(["Aathi Iva Yarraa Sony Music South", "Aathi Iva Yarraa"]);
    expect(result.tracks).toEqual([song]);
  });

  it("finds a release too new for catalog search through its artist", async () => {
    const song = track({ provider: "deezer", id: "deezer:20", title: 'Aathi Iva Yarraa (From "Scene")', artists: ["Sushin Shyam"] });
    const findInArtistReleases = vi.fn(async () => [song]);
    const deezer = stubProvider("deezer", { findInArtistReleases });
    const searchAppleSongs = vi.fn(async () => [
      { title: 'Aathi Iva Yarraa (From "Scene")', artist: "Sushin Shyam & Rajpriyan", durationMs: 187764 },
    ]);

    const fromLink = await resolveQuery("https://youtu.be/bN1t-9ZH-uU", {
      providers: [deezer],
      cache,
      searchAppleSongs,
      fetchLinkTitle: async () => ({ title: "Aathi Iva Yarraa Lyric | SCENE | Suriya", author: "Sony Music South" }),
    });
    expect(searchAppleSongs).toHaveBeenCalledWith("Aathi Iva Yarraa");
    expect(findInArtistReleases).toHaveBeenCalledWith('Aathi Iva Yarraa (From "Scene")', [
      "Sushin Shyam",
      "Rajpriyan",
      "Sony Music South",
      "SCENE",
    ]);
    expect(fromLink).toMatchObject({ kind: "link-match", tracks: [song] });

    const typed = await resolveQuery("aathi iva yarraa", { providers: [deezer], cache: new TtlCache<unknown>(), searchAppleSongs });
    expect(typed).toMatchObject({ kind: "text", provider: { id: "deezer" }, tracks: [song], nextOffset: null });
  });

  it("leaves a confident search alone", async () => {
    const findInArtistReleases = vi.fn(async () => []);
    const searchAppleSongs = vi.fn(async () => []);
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([track({ provider: "deezer" })])), findInArtistReleases });
    await resolveQuery("die with a smile", { providers: [deezer], cache, searchAppleSongs });
    expect(searchAppleSongs).not.toHaveBeenCalled();
    expect(findInArtistReleases).not.toHaveBeenCalled();
  });

  it("offers nothing rather than a different song", async () => {
    const wrong = track({ provider: "deezer", title: "Aathi", artists: ["Anirudh Ravichander"], album: "Kaththi" });
    const deezer = stubProvider("deezer", { searchTracks: vi.fn(async () => page([wrong])) });
    await expect(
      resolveQuery("https://youtu.be/bN1t-9ZH-uU", {
        providers: [deezer],
        cache,
        fetchLinkTitle: async () => ({ title: "Aathi Iva Yarraa Lyric | SCENE", author: "Sony Music South" }),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", publicMessage: expect.stringContaining('"Aathi Iva Yarraa" isn\'t in the catalog') });
  });

  it("says so when a link can't be read or matches nothing", async () => {
    const deezer = stubProvider("deezer");
    await expect(
      resolveQuery("https://soundcloud.com/forss/flickermood", { providers: [deezer], cache, fetchLinkTitle: async () => null }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", publicMessage: expect.stringContaining("SoundCloud link couldn't be read") });
    await expect(
      resolveQuery("https://soundcloud.com/forss/flickermood", {
        providers: [deezer],
        cache: new TtlCache<unknown>(),
        fetchLinkTitle: async () => ({ title: "Flickermood by Forss", author: "Forss" }),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("link titles", () => {
  it("strips video labels and uploader suffixes", () => {
    expect(linkTitleToSearch("youtube", { title: "Blinding Lights (Official Audio)", author: "The Weeknd - Topic" })).toEqual({
      song: "Blinding Lights",
      names: ["Blinding Lights"],
      queries: ["Blinding Lights The Weeknd", "Blinding Lights"],
      credits: ["The Weeknd"],
    });
    expect(linkTitleToSearch("youtube", { title: "Artist - Song [Lyrics] | Extra", author: "SomeChannel" })).toEqual({
      song: "Artist - Song",
      names: ["Artist - Song", "Song"],
      queries: ["Artist - Song", "Song", "Artist"],
      credits: ["Artist", "SomeChannel", "Extra"],
    });
    expect(linkTitleToSearch("soundcloud", { title: "Flickermood by Forss", author: "Forss" }).queries[0]).toBe("Flickermood Forss");
  });

  it("keeps brackets that name a different version", () => {
    expect(linkTitleToSearch("youtube", { title: "Song (Slowed + Reverb) (feat. Guest)", author: "Artist" }).song).toBe(
      "Song (Slowed + Reverb)",
    );
    expect(linkTitleToSearch("youtube", { title: "Luis Fonsi - Despacito ft. Daddy Yankee", author: "LuisFonsiVEVO" }).names).toEqual([
      "Luis Fonsi - Despacito",
      "Despacito",
    ]);
    expect(linkTitleToSearch("youtube", { title: "Love Song Lyrical Video", author: "Label" }).song).toBe("Love Song");
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
    expect(variants[0]).toBe("die with a smile");
    expect(variants).toContain("with a smile xqzv");
    expect(relaxedQueries("a b c d e f g h").length).toBe(6);
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
      resolveQuery(`https://open.spotify.com/track/${ID}`, {
        providers: [spotify, deezer],
        cache,
        fetchSpotifyTitle: noTitle,
      }),
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
      resolveQuery(`spotify:track:${ID}`, {
        providers: [spotify, stubProvider("deezer")],
        cache,
        fetchSpotifyTitle: noTitle,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_AUTH", publicMessage: expect.stringContaining("Search by song title") });
  });

  it("shows a track whose ISRC is missing rather than failing", async () => {
    const spotify = stubProvider("spotify", { getTrack: vi.fn(async () => track({ isrc: null })) });
    const result = await resolveQuery(`spotify:track:${ID}`, { providers: [spotify], cache });
    expect(result.tracks[0].isrc).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { DeezerProvider, mapDeezerTrack } from "@/lib/deezer/provider";
import { DEEZER_API, fakeFetch, json, noSleep } from "./helpers/fake-fetch";

const deezerTrack = (overrides: Record<string, unknown> = {}) => ({
  id: 2947516331,
  title: "Die With A Smile",
  isrc: "USUM72409273",
  link: "https://www.deezer.com/track/2947516331",
  duration: 250,
  explicit_lyrics: false,
  artist: { name: "Lady Gaga" },
  album: { title: "Die With A Smile", cover_medium: "https://cdn-images.dzcdn.net/images/cover/x/250x250.jpg" },
  ...overrides,
});

const make = (routes: Parameters<typeof fakeFetch>[0]) => {
  const fake = fakeFetch(routes);
  return { ...fake, provider: new DeezerProvider({ fetchImpl: fake.fetchImpl, sleep: noSleep }) };
};

describe("mapDeezerTrack", () => {
  it("maps catalog metadata", () => {
    expect(mapDeezerTrack(deezerTrack())).toMatchObject({
      id: "deezer:2947516331",
      provider: "deezer",
      title: "Die With A Smile",
      artists: ["Lady Gaga"],
      isrc: "USUM72409273",
      durationMs: 250_000,
      releaseDate: null,
      url: "https://www.deezer.com/track/2947516331",
    });
  });

  it("prefers the full contributor list and drops insecure artwork", () => {
    const track = mapDeezerTrack(
      deezerTrack({
        contributors: [{ name: "Lady Gaga" }, { name: "Bruno Mars" }],
        album: { title: "A", cover_medium: "http://insecure.example/a.jpg" },
        release_date: "2024-08-16",
      }),
    );
    expect(track?.artists).toEqual(["Lady Gaga", "Bruno Mars"]);
    expect(track?.artworkUrl).toBeNull();
    expect(track?.releaseDate).toBe("2024-08-16");
  });

  it("passes on the official preview clip only when it is served over https", () => {
    expect(mapDeezerTrack(deezerTrack({ preview: "https://cdnt-preview.dzcdn.net/a.mp3" }))?.previewUrl).toBe(
      "https://cdnt-preview.dzcdn.net/a.mp3",
    );
    expect(mapDeezerTrack(deezerTrack({ preview: "http://insecure.example/a.mp3" }))?.previewUrl).toBeNull();
    expect(mapDeezerTrack(deezerTrack())?.previewUrl).toBeNull();
  });

  it("keeps a missing ISRC as null", () => {
    expect(mapDeezerTrack(deezerTrack({ isrc: "" }))?.isrc).toBeNull();
    expect(mapDeezerTrack(deezerTrack({ isrc: undefined }))?.isrc).toBeNull();
  });
});

describe("DeezerProvider", () => {
  it("searches with paging", async () => {
    const { provider, calls } = make({
      [`${DEEZER_API}/search/track`]: () =>
        json({ data: [deezerTrack(), deezerTrack({ id: 2, title: "Second" })], total: 30, next: "x" }),
    });
    const page = await provider.searchTracks("die with a smile", { offset: 10 });
    expect(page.tracks).toHaveLength(2);
    expect(page.nextOffset).toBe(12);
    expect(page.total).toBe(30);
    const params = new URL(calls[0].url).searchParams;
    expect(params.get("index")).toBe("10");
    expect(params.get("limit")).toBe("10");
  });

  it("looks up a recording by ISRC and returns nothing when there is no data", async () => {
    const { provider } = make({
      [`${DEEZER_API}/track/isrc:USUM72409273`]: () => json(deezerTrack()),
      [`${DEEZER_API}/track/isrc`]: () => json({ error: { type: "DataException", code: 800 } }),
    });
    expect(await provider.findByIsrc("USUM72409273")).toHaveLength(1);
    expect(await provider.findByIsrc("GBAYE0601498")).toEqual([]);
  });

  it("maps quota errors to RATE_LIMITED and other errors to PROVIDER_UNAVAILABLE", async () => {
    const quota = make({ [DEEZER_API]: () => json({ error: { type: "Exception", code: 4 } }) });
    await expect(quota.provider.searchTracks("x y")).rejects.toMatchObject({ code: "RATE_LIMITED" });

    const busy = make({ [DEEZER_API]: () => json({ error: { type: "Exception", code: 700 } }) });
    await expect(busy.provider.searchTracks("x y")).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("validates track ids before calling the API", async () => {
    const { provider, calls } = make({});
    expect(await provider.getTrack("../secret")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("finds a new song through its artist's releases", async () => {
    const { provider, calls } = make({
      [`${DEEZER_API}/search/artist`]: () => json({ data: [{ id: 9, name: "Other" }, { id: 7, name: "Sushin Shyam" }] }),
      [`${DEEZER_API}/artist/7/albums`]: () =>
        json({
          data: [
            { id: 1, title: "Old Score", release_date: "2019-01-01" },
            { id: 2, title: "Aathi Iva Yarraa", release_date: "2019-02-01", cover_medium: "https://cdn-images.dzcdn.net/c.jpg" },
          ],
        }),
      [`${DEEZER_API}/album/2/tracks`]: () =>
        json({
          data: [
            deezerTrack({ id: 20, title: 'Aathi Iva Yarraa (From "Scene")', isrc: "INS172607243", album: undefined }),
            deezerTrack({ id: 21, title: 'Scenuke Scene (From "Scene")', isrc: "INS172606735", album: undefined }),
          ],
        }),
    });
    const tracks = await provider.findInArtistReleases('Aathi Iva Yarraa (From "Scene")', ["Sushin Shyam"]);
    expect(tracks).toMatchObject([
      { id: "deezer:20", isrc: "INS172607243", album: "Aathi Iva Yarraa", releaseDate: "2019-02-01", artworkUrl: "https://cdn-images.dzcdn.net/c.jpg" },
    ]);
    expect(calls.some((call) => call.url.includes("/album/1/"))).toBe(false);
  });

  it("returns nothing when the artist isn't in the catalog", async () => {
    const { provider, calls } = make({ [`${DEEZER_API}/search/artist`]: () => json({ data: [{ id: 9, name: "Someone Else" }] }) });
    expect(await provider.findInArtistReleases("Song", ["Sushin Shyam"])).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});

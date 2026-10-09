import { describe, expect, it } from "vitest";
import { SpotifyAuth } from "@/lib/spotify/auth";
import { mapSpotifyTrack, SpotifyProvider } from "@/lib/spotify/provider";
import {
  fakeFetch,
  json,
  noSleep,
  SPOTIFY_API,
  spotifySearch,
  spotifyTrack,
  TOKEN_URL,
  tokenOk,
} from "./helpers/fake-fetch";

const credentials = { clientId: "client-id", clientSecret: "client-secret" };

describe("SpotifyAuth", () => {
  it("requests a token with the client credentials grant and caches it", async () => {
    const { fetchImpl, calls } = fakeFetch({ [TOKEN_URL]: tokenOk });
    const auth = new SpotifyAuth(credentials, { fetchImpl, sleep: noSleep, now: () => 0 });

    expect(await auth.getAccessToken()).toBe("token-1");
    expect(await auth.getAccessToken()).toBe("token-1");
    expect(calls).toHaveLength(1);

    const { init } = calls[0];
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
    );
    expect(String(init.body)).toBe("grant_type=client_credentials");
  });

  it("shares one token request between concurrent callers", async () => {
    const { fetchImpl, calls } = fakeFetch({ [TOKEN_URL]: tokenOk });
    const auth = new SpotifyAuth(credentials, { fetchImpl, sleep: noSleep });
    await Promise.all([auth.getAccessToken(), auth.getAccessToken(), auth.getAccessToken()]);
    expect(calls).toHaveLength(1);
  });

  it("re-requests the token shortly before it expires", async () => {
    let now = 0;
    const { fetchImpl, calls } = fakeFetch({
      [TOKEN_URL]: [
        () => json({ access_token: "first", expires_in: 3600 }),
        () => json({ access_token: "second", expires_in: 3600 }),
      ],
    });
    const auth = new SpotifyAuth(credentials, { fetchImpl, sleep: noSleep, now: () => now });

    expect(await auth.getAccessToken()).toBe("first");
    now = 3_500_000; // still ahead of the 60 s safety margin
    expect(await auth.getAccessToken()).toBe("first");
    now = 3_541_000;
    expect(await auth.getAccessToken()).toBe("second");
    expect(calls).toHaveLength(2);
  });

  it("fails with PROVIDER_AUTH and never leaks the secret", async () => {
    const { fetchImpl } = fakeFetch({
      [TOKEN_URL]: () => json({ error: "invalid_client" }, { status: 400 }),
    });
    const auth = new SpotifyAuth(credentials, { fetchImpl, sleep: noSleep });
    const error = await auth.getAccessToken().catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "PROVIDER_AUTH" });
    expect(JSON.stringify(error) + String((error as Error).message)).not.toContain("client-secret");
  });

  it("rejects malformed token responses", async () => {
    const { fetchImpl } = fakeFetch({ [TOKEN_URL]: () => json({ access_token: 5 }) });
    const auth = new SpotifyAuth(credentials, { fetchImpl, sleep: noSleep });
    await expect(auth.getAccessToken()).rejects.toMatchObject({ code: "PROVIDER_AUTH" });
  });
});

describe("mapSpotifyTrack", () => {
  it("maps real metadata including the ISRC from external_ids", () => {
    expect(mapSpotifyTrack(spotifyTrack())).toEqual({
      id: "spotify:2plbrEY59IikOBgBGLjaoe",
      provider: "spotify",
      title: "Die With A Smile",
      artists: ["Lady Gaga", "Bruno Mars"],
      album: "Die With A Smile",
      artworkUrl: "https://i.scdn.co/image/medium",
      isrc: "USUM72409273",
      durationMs: 251667,
      releaseDate: "2024-08-16",
      explicit: false,
      url: "https://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe",
      versionTags: [],
    });
  });

  it("leaves the ISRC null when Spotify has none, without inventing one", () => {
    expect(mapSpotifyTrack(spotifyTrack({ external_ids: {} }))?.isrc).toBeNull();
    expect(mapSpotifyTrack(spotifyTrack({ external_ids: null }))?.isrc).toBeNull();
    expect(mapSpotifyTrack(spotifyTrack({ external_ids: { isrc: "not-an-isrc" } }))?.isrc).toBeNull();
  });

  it("normalises hyphenated or lower-case codes", () => {
    expect(mapSpotifyTrack(spotifyTrack({ external_ids: { isrc: "us-um7-24-09273" } }))?.isrc).toBe(
      "USUM72409273",
    );
  });

  it("labels alternative versions", () => {
    const tags = (name: string) => mapSpotifyTrack(spotifyTrack({ name }))?.versionTags;
    expect(tags("Bohemian Rhapsody - Remastered 2011")).toEqual(["Remastered"]);
    expect(tags("Hotel California (Live at The Forum)")).toEqual(["Live"]);
    expect(tags("Escapism. (Sped Up)")).toEqual(["Sped up"]);
    expect(tags("Love Story (Taylor's Version)")).toEqual(["Re-recorded"]);
    expect(tags("Live Forever")).toEqual([]);
  });

  it("skips malformed items", () => {
    expect(mapSpotifyTrack(null)).toBeNull();
    expect(mapSpotifyTrack({ name: "No id" })).toBeNull();
  });
});

describe("SpotifyProvider", () => {
  const make = (routes: Parameters<typeof fakeFetch>[0]) => {
    const fake = fakeFetch({ [TOKEN_URL]: tokenOk, ...routes });
    return { ...fake, provider: new SpotifyProvider(credentials, { fetchImpl: fake.fetchImpl, sleep: noSleep }) };
  };

  it("is unconfigured without credentials and refuses to call the API", async () => {
    const provider = new SpotifyProvider({});
    expect(provider.isConfigured()).toBe(false);
    await expect(provider.searchTracks("anything")).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });

  it("searches tracks with the bearer token and Spotify's page cap", async () => {
    const { provider, calls } = make({
      [`${SPOTIFY_API}/search`]: () =>
        spotifySearch([spotifyTrack(), null, spotifyTrack({ id: "1".repeat(22), name: "Other" })], {
          total: 42,
          next: "https://api.spotify.com/v1/search?offset=3",
        }),
    });
    const page = await provider.searchTracks("die with a smile", { limit: 50 });

    expect(page.tracks.map((track) => track.title)).toEqual(["Die With A Smile", "Other"]);
    expect(page.total).toBe(42);
    expect(page.nextOffset).toBe(3);

    const search = calls.find((call) => call.url.includes("/search"))!;
    const params = new URL(search.url).searchParams;
    expect(params.get("q")).toBe("die with a smile");
    expect(params.get("type")).toBe("track");
    expect(params.get("limit")).toBe("10");
    expect(params.has("market")).toBe(false);
    expect((search.init.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
  });

  it("uses the isrc: filter and keeps every recording that shares the code", async () => {
    const { provider, calls } = make({
      [`${SPOTIFY_API}/search`]: () =>
        spotifySearch([
          spotifyTrack(),
          spotifyTrack({ id: "3".repeat(22), album: { name: "Compilation" } }),
          spotifyTrack({ id: "4".repeat(22), external_ids: { isrc: "GBAYE0601498" } }),
        ]),
    });
    const tracks = await provider.findByIsrc("USUM72409273");
    expect(tracks.map((track) => track.album)).toEqual(["Die With A Smile", "Compilation"]);
    expect(new URL(calls.at(-1)!.url).searchParams.get("q")).toBe("isrc:USUM72409273");
  });

  it("looks up an exact track by id and returns null for 404", async () => {
    const { provider } = make({
      [`${SPOTIFY_API}/tracks/2plbrEY59IikOBgBGLjaoe`]: () => json(spotifyTrack()),
      [`${SPOTIFY_API}/tracks/`]: () => json({ error: { status: 404 } }, { status: 404 }),
    });
    expect((await provider.getTrack("2plbrEY59IikOBgBGLjaoe"))?.isrc).toBe("USUM72409273");
    expect(await provider.getTrack("9".repeat(22))).toBeNull();
    expect(await provider.getTrack("../../etc/passwd")).toBeNull();
  });

  it("refreshes the token once when Spotify answers 401", async () => {
    const { provider, calls } = make({
      [TOKEN_URL]: [
        () => json({ access_token: "stale", expires_in: 3600 }),
        () => json({ access_token: "fresh", expires_in: 3600 }),
      ],
      [`${SPOTIFY_API}/search`]: [
        () => json({ error: { status: 401 } }, { status: 401 }),
        () => spotifySearch([spotifyTrack()]),
      ],
    });
    const page = await provider.searchTracks("x y");
    expect(page.tracks).toHaveLength(1);
    const bearer = calls
      .filter((call) => call.url.includes("/search"))
      .map((call) => (call.init.headers as Record<string, string>).Authorization);
    expect(bearer).toEqual(["Bearer stale", "Bearer fresh"]);
  });

  it("reports rate limiting, forbidden access and outages distinctly", async () => {
    const limited = make({
      [`${SPOTIFY_API}/search`]: () => new Response(null, { status: 429, headers: { "retry-after": "20" } }),
    });
    await expect(limited.provider.searchTracks("x y")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 20,
    });

    const forbidden = make({ [`${SPOTIFY_API}/search`]: () => new Response(null, { status: 403 }) });
    await expect(forbidden.provider.searchTracks("x y")).rejects.toMatchObject({ code: "PROVIDER_AUTH" });

    const down = make({ [`${SPOTIFY_API}/search`]: () => new Response(null, { status: 503 }) });
    await expect(down.provider.searchTracks("x y")).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
});

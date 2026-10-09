import { describe, expect, it } from "vitest";
import { resolveSpotifyShortLink } from "@/lib/spotify/short-link";
import { fakeFetch } from "./helpers/fake-fetch";

const ID = "2plbrEY59IikOBgBGLjaoe";
const redirect = (location: string, status = 307) => () =>
  new Response(null, { status, headers: { location } });

describe("resolveSpotifyShortLink", () => {
  it("follows a share link to the track it points at", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "https://spotify.link/abc": redirect(`https://open.spotify.com/track/${ID}?si=xyz`),
    });
    expect(await resolveSpotifyShortLink("https://spotify.link/abc", { fetchImpl })).toBe(ID);
    expect(calls).toHaveLength(1);
    expect(calls[0].init.redirect).toBe("manual");
  });

  it("follows several trusted hops", async () => {
    const { fetchImpl } = fakeFetch({
      "https://spotify.link/abc": redirect("https://spotify.app.link/abc"),
      "https://spotify.app.link/abc": redirect(`https://open.spotify.com/intl-de/track/${ID}`),
    });
    expect(await resolveSpotifyShortLink("https://spotify.link/abc", { fetchImpl })).toBe(ID);
  });

  it("reads the track link from an HTML landing page", async () => {
    const { fetchImpl } = fakeFetch({
      "https://spotify.link/abc": () =>
        new Response(`<html><a href="https://open.spotify.com/track/${ID}?si=1">Open</a></html>`, {
          status: 200,
        }),
    });
    expect(await resolveSpotifyShortLink("https://spotify.link/abc", { fetchImpl })).toBe(ID);
  });

  it.each([
    "https://evil.example/steal",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:3000/admin",
    "https://10.0.0.5/",
    "http://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe",
    "file:///etc/passwd",
  ])("refuses to follow a redirect to %s", async (target) => {
    const { fetchImpl, calls } = fakeFetch({ "https://spotify.link/abc": redirect(target) });
    await expect(
      resolveSpotifyShortLink("https://spotify.link/abc", { fetchImpl }),
    ).rejects.toMatchObject({ code: "UNRESOLVABLE_LINK" });
    // Only the original share link was ever requested.
    expect(calls.map((call) => call.url)).toEqual(["https://spotify.link/abc"]);
  });

  it("never requests an untrusted starting URL", async () => {
    const { fetchImpl, calls } = fakeFetch({});
    await expect(
      resolveSpotifyShortLink("https://example.com/abc", { fetchImpl }),
    ).rejects.toMatchObject({ code: "UNRESOLVABLE_LINK" });
    expect(calls).toHaveLength(0);
  });

  it("stops after a bounded number of hops", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "https://spotify.link/": redirect("https://spotify.link/loop"),
    });
    await expect(
      resolveSpotifyShortLink("https://spotify.link/loop", { fetchImpl }),
    ).rejects.toMatchObject({ code: "UNRESOLVABLE_LINK" });
    expect(calls.length).toBeLessThanOrEqual(4);
  });

  it("explains when the share link is for an album, not a track", async () => {
    const { fetchImpl } = fakeFetch({
      "https://spotify.link/abc": redirect("https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy"),
    });
    await expect(
      resolveSpotifyShortLink("https://spotify.link/abc", { fetchImpl }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("treats upstream failures and dead links as unresolvable", async () => {
    const dead = fakeFetch({ "https://spotify.link/abc": () => new Response(null, { status: 404 }) });
    await expect(
      resolveSpotifyShortLink("https://spotify.link/abc", { fetchImpl: dead.fetchImpl }),
    ).rejects.toMatchObject({ code: "UNRESOLVABLE_LINK" });

    const down = fakeFetch({ "https://spotify.link/abc": () => new Response(null, { status: 503 }) });
    await expect(
      resolveSpotifyShortLink("https://spotify.link/abc", { fetchImpl: down.fetchImpl }),
    ).rejects.toMatchObject({ code: "UNRESOLVABLE_LINK" });
  });
});

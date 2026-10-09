import { describe, expect, it } from "vitest";
import { detectInput, MAX_QUERY_LENGTH } from "@/lib/search/detect";
import {
  formatInstagramIsrc,
  formatIsrcHyphenated,
  parseIsrc,
} from "@/lib/search/isrc";

const TRACK_ID = "2plbrEY59IikOBgBGLjaoe";

describe("detectInput: free text", () => {
  it.each([
    ["Die With A Smile", "Die With A Smile"],
    ["Lady Gaga", "Lady Gaga"],
    ["Lady Gaga Bruno Mars", "Lady Gaga Bruno Mars"],
    ["Die With A Smile Lady Gaga", "Die With A Smile Lady Gaga"],
    ["  die   with  ", "die with"],
  ])("treats %j as a text query", (input, query) => {
    expect(detectInput(input)).toEqual({ kind: "text", query });
  });

  it("returns empty for blank input", () => {
    expect(detectInput("   \n\t ")).toEqual({ kind: "empty" });
  });

  it("strips control characters", () => {
    expect(detectInput("bad\u0000 guy\u0007")).toEqual({ kind: "text", query: "bad guy" });
  });

  it("rejects overly long input", () => {
    const result = detectInput("a".repeat(MAX_QUERY_LENGTH + 1));
    expect(result).toMatchObject({ kind: "invalid", reason: "too-long" });
  });

  it("keeps text that merely mentions the word isrc", () => {
    expect(detectInput("what is an isrc")).toEqual({ kind: "text", query: "what is an isrc" });
  });
});

describe("detectInput: Spotify links", () => {
  it("accepts a plain track URL", () => {
    expect(detectInput(`https://open.spotify.com/track/${TRACK_ID}`)).toEqual({
      kind: "spotify-track",
      trackId: TRACK_ID,
    });
  });

  it("ignores tracking parameters and fragments", () => {
    expect(
      detectInput(`https://open.spotify.com/track/${TRACK_ID}?si=abc123&utm_source=copy#x`),
    ).toEqual({ kind: "spotify-track", trackId: TRACK_ID });
  });

  it("accepts localised, embed and scheme-less links", () => {
    for (const link of [
      `https://open.spotify.com/intl-de/track/${TRACK_ID}`,
      `https://open.spotify.com/embed/track/${TRACK_ID}`,
      `open.spotify.com/track/${TRACK_ID}`,
    ]) {
      expect(detectInput(link)).toEqual({ kind: "spotify-track", trackId: TRACK_ID });
    }
  });

  it("accepts a Spotify URI", () => {
    expect(detectInput(`spotify:track:${TRACK_ID}`)).toEqual({
      kind: "spotify-track",
      trackId: TRACK_ID,
    });
  });

  it("recognises supported short links and drops their query string", () => {
    expect(detectInput("https://spotify.link/AbCd123xyz?si=1")).toEqual({
      kind: "spotify-short-link",
      url: "https://spotify.link/AbCd123xyz",
    });
    expect(detectInput("https://spotify.app.link/AbCd123xyz")).toEqual({
      kind: "spotify-short-link",
      url: "https://spotify.app.link/AbCd123xyz",
    });
  });

  it.each([
    "https://open.spotify.com/track/not-a-real-id",
    "https://open.spotify.com/track/",
    "spotify:track:short",
    `spotify:track:${TRACK_ID}:extra`,
    "https://spotify.link/",
    "https://spotify.link/a/b/c",
  ])("rejects malformed track link %j", (input) => {
    expect(detectInput(input)).toMatchObject({
      kind: "invalid",
      reason: "invalid-spotify-link",
    });
  });

  it.each([
    "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy",
    "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "spotify:artist:1HY2Jd0NmPuamShAr6KMms",
  ])("explains that %j is not a track", (input) => {
    expect(detectInput(input)).toMatchObject({
      kind: "invalid",
      reason: "unsupported-spotify-type",
    });
  });

  it.each([
    "https://example.com/track/2plbrEY59IikOBgBGLjaoe",
    "https://open.spotify.com.evil.example/track/2plbrEY59IikOBgBGLjaoe",
    "http://127.0.0.1/track/2plbrEY59IikOBgBGLjaoe",
    "http://169.254.169.254/latest/meta-data/",
    "https://user:pass@open.spotify.com/track/2plbrEY59IikOBgBGLjaoe",
    "https://open.spotify.com:8443/track/2plbrEY59IikOBgBGLjaoe",
    "ftp://open.spotify.com/track/2plbrEY59IikOBgBGLjaoe",
  ])("refuses untrusted URL %j", (input) => {
    expect(detectInput(input)).toMatchObject({ kind: "invalid", reason: "unsupported-url" });
  });
});

describe("detectInput: ISRC codes", () => {
  it.each([
    ["INT202506147", "INT202506147"],
    ["isrc:INT202506147", "INT202506147"],
    ["ISRC: usum72409273", "USUM72409273"],
    ["US-UM7-24-09273", "USUM72409273"],
    ["isrc:US-UM7-24-09273", "USUM72409273"],
    ["gbaye0601498", "GBAYE0601498"],
  ])("normalises %j", (input, isrc) => {
    expect(detectInput(input)).toEqual({ kind: "isrc", isrc });
  });

  it.each(["isrc:", "isrc:hello", "isrc:USUM7240927", "USUM7240927", "US-UM7-24-0927333"])(
    "flags %j as an invalid ISRC",
    (input) => {
      expect(detectInput(input)).toMatchObject({ kind: "invalid", reason: "invalid-isrc" });
    },
  );
});

describe("ISRC formatting", () => {
  it("builds the Instagram search string with the isrc: prefix", () => {
    expect(formatInstagramIsrc("usum72409273")).toBe("isrc:USUM72409273");
    expect(formatInstagramIsrc("US-UM7-24-09273")).toBe("isrc:USUM72409273");
  });

  it("formats the hyphenated display form", () => {
    expect(formatIsrcHyphenated("USUM72409273")).toBe("US-UM7-24-09273");
  });

  it("parses only well-formed codes", () => {
    expect(parseIsrc("USUM72409273")).toBe("USUM72409273");
    expect(parseIsrc("1SUM72409273")).toBeNull();
    expect(parseIsrc("USUM7240927X")).toBeNull();
  });
});

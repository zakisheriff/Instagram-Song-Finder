import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";

describe("parseServerEnv", () => {
  it("accepts a fully configured environment", () => {
    expect(
      parseServerEnv({ SPOTIFY_CLIENT_ID: "id", SPOTIFY_CLIENT_SECRET: "secret", MUSIC_PROVIDERS: "Spotify, deezer" }),
    ).toEqual({ SPOTIFY_CLIENT_ID: "id", SPOTIFY_CLIENT_SECRET: "secret", MUSIC_PROVIDERS: ["spotify", "deezer"] });
  });

  it("treats blank values as unset and applies the default provider order", () => {
    expect(parseServerEnv({ SPOTIFY_CLIENT_ID: "", SPOTIFY_CLIENT_SECRET: "  " })).toEqual({
      MUSIC_PROVIDERS: ["spotify", "deezer"],
    });
  });

  it("fails when only one Spotify credential is present, without echoing values", () => {
    const attempt = () => parseServerEnv({ SPOTIFY_CLIENT_ID: "my-real-client-id" });
    expect(attempt).toThrow(/SPOTIFY_CLIENT_SECRET/);
    expect(attempt).not.toThrow(/my-real-client-id/);
  });

  it("rejects unknown or repeated providers", () => {
    expect(() => parseServerEnv({ MUSIC_PROVIDERS: "spotify,napster" })).toThrow(/MUSIC_PROVIDERS/);
    expect(() => parseServerEnv({ MUSIC_PROVIDERS: "deezer,deezer" })).toThrow(/MUSIC_PROVIDERS/);
  });
});

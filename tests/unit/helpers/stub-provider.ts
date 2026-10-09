import { vi } from "vitest";
import type { MusicProvider, ProviderId, SearchPage, Track } from "@/lib/music/types";

export function track(overrides: Partial<Track> = {}): Track {
  return {
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
    ...overrides,
  };
}

export const page = (tracks: Track[], nextOffset: number | null = null): SearchPage => ({
  tracks,
  nextOffset,
  total: tracks.length,
});

export function stubProvider(id: ProviderId, overrides: Partial<MusicProvider> = {}) {
  const provider = {
    info: { id, name: id === "spotify" ? "Spotify" : "Deezer" },
    maxPageSize: 10,
    isConfigured: vi.fn(() => true),
    searchTracks: vi.fn(async () => page([])),
    findByIsrc: vi.fn(async () => [] as Track[]),
    getTrack: vi.fn(async () => null as Track | null),
    ...overrides,
  };
  return provider satisfies MusicProvider;
}

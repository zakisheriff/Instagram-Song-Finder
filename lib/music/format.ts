import type { Track } from "./types";

/** `251667` → `4:11`. */
export function formatDuration(durationMs: number | null): string | null {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** `2024-08-16` → `2024`. */
export function releaseYear(releaseDate: string | null): string | null {
  const year = releaseDate?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? year : null;
}

export function formatArtists(artists: string[]): string {
  return artists.length > 0 ? artists.join(", ") : "Unknown artist";
}

/** One-line summary that helps tell near-identical recordings apart. */
export function trackMetaLine(track: Track): string {
  return [track.album, releaseYear(track.releaseDate), formatDuration(track.durationMs)]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

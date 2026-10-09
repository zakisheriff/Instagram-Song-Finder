import { INSTAGRAM_ISRC_PREFIX, looksLikeIsrc, parseIsrc } from "./isrc";

/** Longest query the universal search box accepts. */
export const MAX_QUERY_LENGTH = 200;

/** Shortest free-text query worth sending to a catalog search. */
export const MIN_TEXT_QUERY_LENGTH = 2;

const SPOTIFY_ID_PATTERN = /^[A-Za-z0-9]{22}$/;
const SHORT_LINK_PATH_PATTERN = /^\/[A-Za-z0-9_-]{1,64}\/?$/;

export const SPOTIFY_WEB_HOSTS: ReadonlySet<string> = new Set([
  "open.spotify.com",
  "play.spotify.com",
]);

export const SPOTIFY_SHORT_LINK_HOSTS: ReadonlySet<string> = new Set([
  "spotify.link",
  "spotify.app.link",
]);

const SPOTIFY_ENTITY_TYPES: ReadonlySet<string> = new Set([
  "album",
  "artist",
  "playlist",
  "episode",
  "show",
  "user",
  "audiobook",
  "chapter",
  "concert",
  "prerelease",
]);

export const APPLE_MUSIC_HOSTS: ReadonlySet<string> = new Set([
  "music.apple.com",
  "geo.music.apple.com",
]);

export const DEEZER_HOSTS: ReadonlySet<string> = new Set(["www.deezer.com", "deezer.com"]);

export const YOUTUBE_HOSTS: ReadonlySet<string> = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

export const SOUNDCLOUD_HOSTS: ReadonlySet<string> = new Set([
  "soundcloud.com",
  "www.soundcloud.com",
  "m.soundcloud.com",
]);

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const SOUNDCLOUD_SLUG_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export type InvalidInputReason =
  | "unsupported-music-link"
  | "too-long"
  | "unsupported-apple-type"
  | "invalid-isrc"
  | "invalid-spotify-link"
  | "unsupported-spotify-type"
  | "unsupported-url";

export type DetectedInput =
  | { kind: "empty" }
  | { kind: "text"; query: string }
  | { kind: "isrc"; isrc: string }
  | { kind: "spotify-track"; trackId: string }
  | { kind: "spotify-short-link"; url: string }
  | { kind: "apple-music-track"; trackId: string; country: string }
  | { kind: "deezer-track"; trackId: string }
  | { kind: "title-link"; service: "youtube" | "soundcloud"; url: string }
  | { kind: "invalid"; reason: InvalidInputReason; message: string };

const INVALID_MESSAGES: Record<InvalidInputReason, string> = {
  "too-long": `That search is too long. Use ${MAX_QUERY_LENGTH} characters or fewer.`,
  "invalid-isrc":
    "That doesn't look like a valid ISRC. An ISRC has 12 characters, such as USUM72409273.",
  "invalid-spotify-link":
    "That Spotify link isn't a valid track link. Copy the link from a song's Share menu and try again.",
  "unsupported-spotify-type":
    "That Spotify link doesn't point to a track. Open the song itself and copy its link.",
  "unsupported-apple-type":
    "That Apple Music link doesn't point to a single song. Open the song, choose Share, then Copy Link.",
  "unsupported-music-link":
    "That link doesn't point to a single song. Open the song itself and copy its link.",
  "unsupported-url":
    "That link isn't from a supported service. Paste a song link from Spotify, Apple Music, YouTube, YouTube Music, Deezer or SoundCloud, or search by title, artist or ISRC.",
};

function invalid(reason: InvalidInputReason): DetectedInput {
  return { kind: "invalid", reason, message: INVALID_MESSAGES[reason] };
}

/** Strips control characters and collapses runs of whitespace. */
export function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSpotifyUri(value: string): DetectedInput | null {
  if (!/^spotify:/i.test(value)) return null;
  const [, type, id, ...rest] = value.split(":");
  if (type?.toLowerCase() === "track") {
    return id && rest.length === 0 && SPOTIFY_ID_PATTERN.test(id)
      ? { kind: "spotify-track", trackId: id }
      : invalid("invalid-spotify-link");
  }
  if (type && SPOTIFY_ENTITY_TYPES.has(type.toLowerCase())) {
    return invalid("unsupported-spotify-type");
  }
  return invalid("invalid-spotify-link");
}

function toUrl(value: string): URL | null {
  if (/\s/.test(value)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  const looksLikeHost = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(value);
  if (!hasScheme && !looksLikeHost) return null;
  try {
    return new URL(hasScheme ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function detectUrl(value: string): DetectedInput | null {
  const url = toUrl(value);
  if (!url) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return invalid("unsupported-url");
  }
  if (url.username || url.password || url.port) return invalid("unsupported-url");

  const host = url.hostname.toLowerCase();

  if (SPOTIFY_SHORT_LINK_HOSTS.has(host)) {
    if (!SHORT_LINK_PATH_PATTERN.test(url.pathname)) {
      return invalid("invalid-spotify-link");
    }
    // Rebuilt from validated parts so no query string or fragment is carried along.
    return {
      kind: "spotify-short-link",
      url: `https://${host}${url.pathname.replace(/\/$/, "")}`,
    };
  }

  if (APPLE_MUSIC_HOSTS.has(host)) {
    const segments = url.pathname.split("/").filter(Boolean);
    const country = /^[a-z]{2}$/i.test(segments[0] ?? "") ? segments.shift()!.toLowerCase() : "us";
    const [type] = segments;
    const last = segments[segments.length - 1] ?? "";
    // Song links end in the song id; album links carry the song in `?i=`.
    const songId =
      type === "song" && /^\d{1,20}$/.test(last)
        ? last
        : type === "album" && /^\d{1,20}$/.test(url.searchParams.get("i") ?? "")
          ? url.searchParams.get("i")!
          : null;
    return songId
      ? { kind: "apple-music-track", trackId: songId, country }
      : invalid("unsupported-apple-type");
  }

  if (DEEZER_HOSTS.has(host)) {
    const segments = url.pathname.split("/").filter(Boolean);
    if (/^[a-z]{2}$/i.test(segments[0] ?? "")) segments.shift();
    const [type, id] = segments;
    return type === "track" && /^\d{1,20}$/.test(id ?? "")
      ? { kind: "deezer-track", trackId: id }
      : invalid("unsupported-music-link");
  }

  if (YOUTUBE_HOSTS.has(host)) {
    const segments = url.pathname.split("/").filter(Boolean);
    const id =
      host === "youtu.be"
        ? segments[0]
        : segments[0] === "watch"
          ? url.searchParams.get("v")
          : segments[0] === "shorts" || segments[0] === "live"
            ? segments[1]
            : null;
    // Rebuilt from the validated id so nothing else from the pasted link is forwarded.
    return id && YOUTUBE_ID_PATTERN.test(id)
      ? { kind: "title-link", service: "youtube", url: `https://www.youtube.com/watch?v=${id}` }
      : invalid("unsupported-music-link");
  }

  if (SOUNDCLOUD_HOSTS.has(host)) {
    const segments = url.pathname.split("/").filter(Boolean);
    const [user, track] = segments;
    const isTrack =
      segments.length === 2 &&
      SOUNDCLOUD_SLUG_PATTERN.test(user) &&
      SOUNDCLOUD_SLUG_PATTERN.test(track) &&
      !["sets", "likes", "tracks", "albums", "reposts"].includes(track) &&
      !["discover", "search", "you", "stream", "charts"].includes(user);
    return isTrack
      ? { kind: "title-link", service: "soundcloud", url: `https://soundcloud.com/${user}/${track}` }
      : invalid("unsupported-music-link");
  }

  if (SPOTIFY_WEB_HOSTS.has(host)) {
    const segments = url.pathname.split("/").filter(Boolean);
    // Localised links look like /intl-de/track/<id>; embeds like /embed/track/<id>.
    while (segments[0] && (/^intl-[a-z-]+$/i.test(segments[0]) || segments[0] === "embed")) {
      segments.shift();
    }
    const [type, id] = segments;
    if (type === "track") {
      return id && segments.length === 2 && SPOTIFY_ID_PATTERN.test(id)
        ? { kind: "spotify-track", trackId: id }
        : invalid("invalid-spotify-link");
    }
    if (type && SPOTIFY_ENTITY_TYPES.has(type)) {
      return invalid("unsupported-spotify-type");
    }
    return invalid("invalid-spotify-link");
  }

  return invalid("unsupported-url");
}

function detectIsrc(value: string): DetectedInput | null {
  if (value.toLowerCase().startsWith(INSTAGRAM_ISRC_PREFIX)) {
    const isrc = parseIsrc(value.slice(INSTAGRAM_ISRC_PREFIX.length));
    return isrc ? { kind: "isrc", isrc } : invalid("invalid-isrc");
  }
  if (/\s/.test(value)) return null;
  const isrc = parseIsrc(value);
  if (isrc) return { kind: "isrc", isrc };
  return looksLikeIsrc(value) ? invalid("invalid-isrc") : null;
}

/**
 * Classifies whatever was typed or pasted into the universal search box.
 * Pure and dependency-free so the browser and the server agree on the result.
 */
export function detectInput(raw: string): DetectedInput {
  if (raw.length > MAX_QUERY_LENGTH * 4) return invalid("too-long");
  const value = sanitizeQuery(raw);
  if (!value) return { kind: "empty" };
  if (value.length > MAX_QUERY_LENGTH) return invalid("too-long");

  return (
    detectSpotifyUri(value) ??
    detectUrl(value) ??
    detectIsrc(value) ?? { kind: "text", query: value }
  );
}

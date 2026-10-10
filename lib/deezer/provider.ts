import { readJson, request } from "@/lib/http/request";
import { MusicError } from "@/lib/music/errors";
import type {
  MusicProvider,
  ProviderInfo,
  ProviderRequestOptions,
  SearchOptions,
  SearchPage,
  Track,
} from "@/lib/music/types";
import { detectVersionTags } from "@/lib/music/version-tags";
import { parseIsrc } from "@/lib/search/isrc";
import { textSimilarity } from "@/lib/search/similarity";

const API_BASE = "https://api.deezer.com";
const DEEZER_MAX_PAGE_SIZE = 10;
const DEEZER_MAX_OFFSET = 1000;

/** Deezer reports failures as HTTP 200 with an `error` object. */
const ERROR_QUOTA = 4;
const ERROR_NO_DATA = 800;

interface DeezerError {
  error?: { type?: string; message?: string; code?: number };
}

interface DeezerTrack extends DeezerError {
  id?: number | string;
  title?: string;
  isrc?: string;
  link?: string;
  preview?: string;
  duration?: number;
  release_date?: string;
  explicit_lyrics?: boolean;
  artist?: { name?: string } | null;
  contributors?: Array<{ name?: string } | null> | null;
  album?: { title?: string; cover_medium?: string | null } | null;
}

interface DeezerSearchResponse extends DeezerError {
  data?: Array<DeezerTrack | null>;
  total?: number;
  next?: string;
}

interface DeezerList<T> extends DeezerError {
  data?: Array<T | null>;
}

interface DeezerArtist {
  id?: number;
  name?: string;
}

interface DeezerAlbum {
  id?: number;
  title?: string;
  release_date?: string;
  cover_medium?: string | null;
}

/** A name or title must match this well to count as the same one. */
const SAME_NAME = 0.8;
/** Releases this recent may not be searchable yet. */
const RECENT_RELEASE_MS = 45 * 24 * 60 * 60 * 1000;
const MAX_ARTISTS = 3;
const MAX_ALBUMS = 4;
const MAX_MATCHES = 5;

/** A title without bracketed credits such as `(From "Film")`, which vary between releases. */
function coreTitle(title: string): string {
  return title.replace(/[([][^)\]]*[)\]]/g, " ").trim() || title;
}

function httpsOrNull(url: string | null | undefined): string | null {
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

export function mapDeezerTrack(raw: DeezerTrack | null | undefined): Track | null {
  if (!raw || raw.id === undefined || typeof raw.title !== "string") return null;

  const contributors = (raw.contributors ?? [])
    .map((artist) => artist?.name)
    .filter((name): name is string => typeof name === "string" && name.length > 0);
  const artists =
    contributors.length > 0 ? contributors : raw.artist?.name ? [raw.artist.name] : [];

  return {
    id: `deezer:${raw.id}`,
    provider: "deezer",
    title: raw.title,
    artists,
    album: raw.album?.title ?? null,
    artworkUrl: httpsOrNull(raw.album?.cover_medium),
    isrc: typeof raw.isrc === "string" ? parseIsrc(raw.isrc) : null,
    durationMs: typeof raw.duration === "number" ? raw.duration * 1000 : null,
    releaseDate:
      raw.release_date && raw.release_date !== "0000-00-00" ? raw.release_date : null,
    explicit: typeof raw.explicit_lyrics === "boolean" ? raw.explicit_lyrics : null,
    previewUrl: httpsOrNull(raw.preview),
    url: httpsOrNull(raw.link) ?? `https://www.deezer.com/track/${raw.id}`,
    versionTags: detectVersionTags(raw.title),
  };
}

export interface DeezerDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Deezer's public catalog API. It needs no credentials, so it serves as the
 * fallback source when Spotify is not configured or is temporarily unavailable.
 */
export class DeezerProvider implements MusicProvider {
  readonly info: ProviderInfo = { id: "deezer", name: "Deezer" };
  readonly maxPageSize = DEEZER_MAX_PAGE_SIZE;

  constructor(private readonly deps: DeezerDeps = {}) {}

  isConfigured(): boolean {
    return true;
  }

  async searchTracks(query: string, options: SearchOptions = {}): Promise<SearchPage> {
    const limit = Math.min(Math.max(options.limit ?? this.maxPageSize, 1), this.maxPageSize);
    const offset = Math.min(Math.max(options.offset ?? 0, 0), DEEZER_MAX_OFFSET);
    const params = new URLSearchParams({ q: query, limit: String(limit), index: String(offset) });

    const body = await this.get<DeezerSearchResponse>(`/search/track?${params}`, options);
    if (body.error) {
      if (body.error.code === ERROR_NO_DATA) return { tracks: [], nextOffset: null, total: 0 };
      throw this.toError(body.error);
    }

    const items = body.data ?? [];
    const tracks = items
      .map((item) => mapDeezerTrack(item))
      .filter((track): track is Track => track !== null);
    const following = offset + items.length;
    const hasMore = Boolean(body.next) && items.length > 0 && following <= DEEZER_MAX_OFFSET;

    return {
      tracks,
      nextOffset: hasMore ? following : null,
      total: typeof body.total === "number" ? body.total : null,
    };
  }

  async findByIsrc(isrc: string, options: ProviderRequestOptions = {}): Promise<Track[]> {
    const body = await this.get<DeezerTrack>(`/track/isrc:${encodeURIComponent(isrc)}`, options);
    if (body.error) {
      if (body.error.code === ERROR_NO_DATA) return [];
      throw this.toError(body.error);
    }
    const track = mapDeezerTrack(body);
    return track && track.isrc === isrc ? [track] : [];
  }

  async getTrack(trackId: string, options: ProviderRequestOptions = {}): Promise<Track | null> {
    if (!/^\d{1,20}$/.test(trackId)) return null;
    const body = await this.get<DeezerTrack>(`/track/${trackId}`, options);
    if (body.error) {
      if (body.error.code === ERROR_NO_DATA) return null;
      throw this.toError(body.error);
    }
    return mapDeezerTrack(body);
  }

  async findInArtistReleases(
    title: string,
    artists: string[],
    options: ProviderRequestOptions = {},
  ): Promise<Track[]> {
    const found = new Map<string, Track>();
    const wanted = coreTitle(title);

    for (const name of artists.slice(0, MAX_ARTISTS)) {
      const params = new URLSearchParams({ q: name, limit: "5" });
      const artistList = await this.get<DeezerList<DeezerArtist>>(`/search/artist?${params}`, options);
      const artist = (artistList.data ?? []).find(
        (item) => item?.id && item.name && textSimilarity(name, item.name) >= SAME_NAME,
      );
      if (!artist?.id) continue;

      // The list isn't in date order, so the newest releases are picked out here.
      const albumList = await this.get<DeezerList<DeezerAlbum>>(
        `/artist/${artist.id}/albums?limit=300`,
        options,
      );
      const newest = Date.now() - RECENT_RELEASE_MS;
      const albums = (albumList.data ?? [])
        .filter((album): album is DeezerAlbum => Boolean(album?.id && album.title))
        .map((album) => ({
          album,
          score: textSimilarity(wanted, coreTitle(album.title ?? "")),
          released: Date.parse(album.release_date ?? "") || 0,
        }))
        .filter(({ score, released }) => score >= SAME_NAME || released >= newest)
        .sort((a, b) => b.score - a.score || b.released - a.released)
        .slice(0, MAX_ALBUMS);

      for (const { album } of albums) {
        const trackList = await this.get<DeezerList<DeezerTrack>>(`/album/${album.id}/tracks?limit=50`, options);
        for (const raw of trackList.data ?? []) {
          if (!raw?.title || textSimilarity(wanted, coreTitle(raw.title)) < SAME_NAME) continue;
          const track = mapDeezerTrack({
            ...raw,
            release_date: album.release_date,
            album: { title: album.title, cover_medium: album.cover_medium },
          });
          if (track) found.set(track.id, track);
        }
        if (found.size >= MAX_MATCHES) break;
      }
      if (found.size > 0) break;
    }
    return [...found.values()].slice(0, MAX_MATCHES);
  }

  private async get<T>(path: string, options: ProviderRequestOptions): Promise<T> {
    const response = await request(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: options.signal,
      fetchImpl: this.deps.fetchImpl,
      sleep: this.deps.sleep,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new MusicError("PROVIDER_UNAVAILABLE", `Deezer returned ${response.status}`);
    }
    return readJson<T>(response);
  }

  private toError(error: NonNullable<DeezerError["error"]>): MusicError {
    return error.code === ERROR_QUOTA
      ? new MusicError("RATE_LIMITED", "Deezer quota exceeded")
      : new MusicError("PROVIDER_UNAVAILABLE", `Deezer error ${error.code ?? "unknown"}`);
  }
}

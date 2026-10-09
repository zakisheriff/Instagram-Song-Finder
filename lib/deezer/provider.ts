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

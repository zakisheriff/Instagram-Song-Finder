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
import { SpotifyAuth, type SpotifyAuthDeps, type SpotifyCredentials } from "./auth";

const API_BASE = "https://api.spotify.com/v1";

/** Spotify caps search pages at 10 items and offsets at 1000. */
export const SPOTIFY_MAX_PAGE_SIZE = 10;
const SPOTIFY_MAX_OFFSET = 1000;

const TARGET_ARTWORK_WIDTH = 300;
const SPOTIFY_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

interface SpotifyImage {
  url?: string;
  width?: number | null;
  height?: number | null;
}

interface SpotifyTrack {
  id?: string;
  name?: string;
  type?: string;
  explicit?: boolean;
  duration_ms?: number;
  external_ids?: { isrc?: string } | null;
  external_urls?: { spotify?: string } | null;
  artists?: Array<{ name?: string } | null> | null;
  album?: {
    name?: string;
    release_date?: string;
    images?: SpotifyImage[] | null;
  } | null;
}

interface SpotifySearchResponse {
  tracks?: {
    items?: Array<SpotifyTrack | null>;
    total?: number;
    offset?: number;
    next?: string | null;
  };
}

function pickArtwork(images: SpotifyImage[] | null | undefined): string | null {
  const usable = (images ?? []).filter(
    (image): image is SpotifyImage & { url: string } =>
      typeof image?.url === "string" && image.url.startsWith("https://"),
  );
  if (usable.length === 0) return null;
  const distance = (image: SpotifyImage) =>
    Math.abs((image.width ?? TARGET_ARTWORK_WIDTH) - TARGET_ARTWORK_WIDTH);
  return usable.reduce((best, image) => (distance(image) < distance(best) ? image : best)).url;
}

/** Maps a Spotify track object to the app's provider-neutral shape. */
export function mapSpotifyTrack(raw: SpotifyTrack | null | undefined): Track | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  if (raw.type !== undefined && raw.type !== "track") return null;

  const artists = (raw.artists ?? [])
    .map((artist) => artist?.name)
    .filter((name): name is string => typeof name === "string" && name.length > 0);

  const rawIsrc = raw.external_ids?.isrc;

  return {
    id: `spotify:${raw.id}`,
    provider: "spotify",
    title: raw.name,
    artists,
    album: raw.album?.name ?? null,
    artworkUrl: pickArtwork(raw.album?.images),
    isrc: typeof rawIsrc === "string" ? parseIsrc(rawIsrc) : null,
    durationMs: typeof raw.duration_ms === "number" ? raw.duration_ms : null,
    releaseDate: raw.album?.release_date ?? null,
    explicit: typeof raw.explicit === "boolean" ? raw.explicit : null,
    url: raw.external_urls?.spotify ?? `https://open.spotify.com/track/${raw.id}`,
    versionTags: detectVersionTags(raw.name),
  };
}

export class SpotifyProvider implements MusicProvider {
  readonly info: ProviderInfo = { id: "spotify", name: "Spotify" };
  readonly maxPageSize = SPOTIFY_MAX_PAGE_SIZE;

  private readonly auth: SpotifyAuth | undefined;

  constructor(
    credentials: Partial<SpotifyCredentials>,
    private readonly deps: SpotifyAuthDeps = {},
  ) {
    this.auth =
      credentials.clientId && credentials.clientSecret
        ? new SpotifyAuth(
            { clientId: credentials.clientId, clientSecret: credentials.clientSecret },
            deps,
          )
        : undefined;
  }

  isConfigured(): boolean {
    return this.auth !== undefined;
  }

  async searchTracks(query: string, options: SearchOptions = {}): Promise<SearchPage> {
    const limit = Math.min(Math.max(options.limit ?? this.maxPageSize, 1), this.maxPageSize);
    const offset = Math.min(Math.max(options.offset ?? 0, 0), SPOTIFY_MAX_OFFSET);

    // No `market` is sent on purpose: with a market Spotify may relink a track
    // to a regional alternative, which can be a different recording and ISRC.
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: String(limit),
      offset: String(offset),
    });

    const response = await this.get(`/search?${params}`, options);
    if (response.status === 400) {
      await response.body?.cancel();
      return { tracks: [], nextOffset: null, total: 0 };
    }
    await this.assertOk(response);

    const body = await readJson<SpotifySearchResponse>(response);
    const items = body.tracks?.items ?? [];
    const tracks = items
      .map((item) => mapSpotifyTrack(item))
      .filter((track): track is Track => track !== null);

    const following = offset + items.length;
    const hasMore =
      Boolean(body.tracks?.next) && items.length > 0 && following <= SPOTIFY_MAX_OFFSET;

    return {
      tracks,
      nextOffset: hasMore ? following : null,
      total: typeof body.tracks?.total === "number" ? body.tracks.total : null,
    };
  }

  async findByIsrc(isrc: string, options: ProviderRequestOptions = {}): Promise<Track[]> {
    const page = await this.searchTracks(`isrc:${isrc}`, { ...options, limit: this.maxPageSize });
    // Guard against loose matching: keep only recordings that carry this exact code.
    return page.tracks.filter((track) => track.isrc === isrc);
  }

  async getTrack(trackId: string, options: ProviderRequestOptions = {}): Promise<Track | null> {
    if (!SPOTIFY_ID_PATTERN.test(trackId)) return null;
    const response = await this.get(`/tracks/${trackId}`, options);
    if (response.status === 404 || response.status === 400) {
      await response.body?.cancel();
      return null;
    }
    await this.assertOk(response);
    return mapSpotifyTrack(await readJson<SpotifyTrack>(response));
  }

  /** Authenticated GET that re-requests the token once if Spotify answers 401. */
  private async get(path: string, options: ProviderRequestOptions): Promise<Response> {
    if (!this.auth) {
      throw new MusicError("NOT_CONFIGURED", "Spotify credentials are not configured");
    }
    const send = async () =>
      request(`${API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${await this.auth!.getAccessToken()}`,
          Accept: "application/json",
        },
        signal: options.signal,
        fetchImpl: this.deps.fetchImpl,
        sleep: this.deps.sleep,
      });

    let response = await send();
    if (response.status === 401) {
      await response.body?.cancel();
      this.auth.invalidate();
      response = await send();
    }
    return response;
  }

  private async assertOk(response: Response): Promise<void> {
    if (response.ok) return;
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403) {
      throw new MusicError("PROVIDER_AUTH", `Spotify refused the request (${response.status})`);
    }
    throw new MusicError("PROVIDER_UNAVAILABLE", `Spotify returned ${response.status}`);
  }
}

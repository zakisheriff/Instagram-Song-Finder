/**
 * Provider-neutral music metadata contracts.
 *
 * Every catalog integration (Spotify, Deezer, or any future source) maps its
 * own payloads into these shapes, so the rest of the app never depends on a
 * specific provider.
 */

export type ProviderId = "spotify" | "deezer";

export interface ProviderInfo {
  id: ProviderId;
  /** Display name used for attribution, e.g. "Spotify". */
  name: string;
}

export interface Track {
  /** Globally unique within the app: `<provider>:<provider track id>`. */
  id: string;
  provider: ProviderId;
  title: string;
  artists: string[];
  album: string | null;
  /** Official album artwork, roughly 250 to 300 px square. */
  artworkUrl: string | null;
  /** Normalized 12-character ISRC, or `null` when the provider has none. */
  isrc: string | null;
  durationMs: number | null;
  /** As precise as the provider reports: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. */
  releaseDate: string | null;
  explicit: boolean | null;
  /** Short official audio preview clip from the provider, when it offers one. */
  previewUrl: string | null;
  /** Link to the recording on the provider's own site. */
  url: string | null;
  /** Labels such as "Live" or "Remastered" that distinguish one recording from another. */
  versionTags: string[];
}

export interface SearchPage {
  tracks: Track[];
  /** Offset to request for the next page, or `null` when there are no more results. */
  nextOffset: number | null;
  /** Total matches reported by the provider, when known. */
  total: number | null;
}

export interface ProviderRequestOptions {
  signal?: AbortSignal;
}

export interface SearchOptions extends ProviderRequestOptions {
  offset?: number;
  limit?: number;
}

export interface MusicProvider {
  readonly info: ProviderInfo;
  /** Largest page this provider can return in one request. */
  readonly maxPageSize: number;
  /** False when required credentials are missing; the provider is then skipped. */
  isConfigured(): boolean;
  searchTracks(query: string, options?: SearchOptions): Promise<SearchPage>;
  /** Every recording the catalog lists under the given ISRC. */
  findByIsrc(isrc: string, options?: ProviderRequestOptions): Promise<Track[]>;
  /** Looks up one recording by this provider's own track id. */
  getTrack(trackId: string, options?: ProviderRequestOptions): Promise<Track | null>;
}

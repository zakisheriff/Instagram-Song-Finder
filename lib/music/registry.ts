import { DeezerProvider } from "@/lib/deezer/provider";
import { getServerEnv } from "@/lib/env";
import { SpotifyProvider } from "@/lib/spotify/provider";
import type { MusicProvider, ProviderId } from "./types";

let providers: MusicProvider[] | undefined;

/**
 * Catalog sources in priority order, as set by `MUSIC_PROVIDERS`.
 *
 * To add a source, implement `MusicProvider`, add its id to `ProviderId` and
 * the environment schema, then register it in `create` below.
 */
export function getProviders(): MusicProvider[] {
  if (providers) return providers;
  const env = getServerEnv();

  const create: Record<ProviderId, () => MusicProvider> = {
    spotify: () =>
      new SpotifyProvider({
        clientId: env.SPOTIFY_CLIENT_ID,
        clientSecret: env.SPOTIFY_CLIENT_SECRET,
      }),
    deezer: () => new DeezerProvider(),
  };

  providers = env.MUSIC_PROVIDERS.map((id) => create[id]());
  return providers;
}

/** Test hook. */
export function resetProviders(): void {
  providers = undefined;
}

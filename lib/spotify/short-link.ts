import { request } from "@/lib/http/request";
import { isMusicError, MusicError } from "@/lib/music/errors";
import {
  detectInput,
  SPOTIFY_SHORT_LINK_HOSTS,
  SPOTIFY_WEB_HOSTS,
} from "@/lib/search/detect";

const MAX_HOPS = 4;
const HOP_TIMEOUT_MS = 4000;
const MAX_BODY_BYTES = 256 * 1024;

const TRACK_LINK_IN_HTML =
  /https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/;

export interface ShortLinkDeps {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Only https URLs on Spotify's own share and web hosts are ever requested.
 * Because the host must match a fixed public allowlist, a redirect can never
 * steer the server towards an internal or private address.
 */
function assertTrustedUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MusicError("UNRESOLVABLE_LINK", "Share link redirect was not a valid URL");
  }
  const host = url.hostname.toLowerCase();
  const trusted =
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.port &&
    (SPOTIFY_SHORT_LINK_HOSTS.has(host) || SPOTIFY_WEB_HOSTS.has(host));
  if (!trusted) {
    throw new MusicError("UNRESOLVABLE_LINK", "Share link redirected to an untrusted host");
  }
  return url;
}

function trackIdFromWebUrl(url: URL): string {
  const detected = detectInput(url.toString());
  if (detected.kind === "spotify-track") return detected.trackId;
  if (detected.kind === "invalid" && detected.reason === "unsupported-spotify-type") {
    throw new MusicError("INVALID_INPUT", "Share link is not a track", {
      publicMessage: detected.message,
    });
  }
  throw new MusicError("UNRESOLVABLE_LINK", "Share link did not lead to a track");
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let received = 0;
  try {
    while (received < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return text;
}

/**
 * Follows a Spotify share link (`spotify.link`, `spotify.app.link`) to the
 * track it points at and returns that track's id. Redirects are followed
 * manually, one validated hop at a time.
 */
export async function resolveSpotifyShortLink(
  shortLink: string,
  deps: ShortLinkDeps = {},
): Promise<string> {
  let current = assertTrustedUrl(shortLink);

  try {
    for (let hop = 0; hop < MAX_HOPS; hop += 1) {
      if (SPOTIFY_WEB_HOSTS.has(current.hostname.toLowerCase())) {
        return trackIdFromWebUrl(current);
      }

      const response = await request(current.toString(), {
        redirect: "manual",
        timeoutMs: HOP_TIMEOUT_MS,
        retries: 0,
        signal: deps.signal,
        fetchImpl: deps.fetchImpl,
        headers: { Accept: "text/html,*/*;q=0.5" },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) break;
        current = assertTrustedUrl(new URL(location, current).toString());
        continue;
      }

      if (response.ok) {
        // Some share links answer with a small HTML page instead of a redirect.
        const match = TRACK_LINK_IN_HTML.exec(await readLimitedText(response));
        if (match?.[1]) return match[1];
      } else {
        await response.body?.cancel();
      }
      break;
    }
  } catch (error) {
    if (isMusicError(error) && error.code !== "UNRESOLVABLE_LINK" && error.code !== "INVALID_INPUT") {
      // Timeouts and upstream failures all mean the same thing to the visitor here.
      throw new MusicError("UNRESOLVABLE_LINK", error.message, { cause: error });
    }
    throw error;
  }

  throw new MusicError("UNRESOLVABLE_LINK", "Share link did not lead to a track");
}

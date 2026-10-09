import { readJson, request } from "@/lib/http/request";
import { MusicError } from "@/lib/music/errors";

const TOKEN_URL = "https://accounts.spotify.com/api/token";

/** Tokens are refreshed this long before Spotify's stated expiry. */
const EXPIRY_SKEW_MS = 60_000;

export interface SpotifyCredentials {
  clientId: string;
  clientSecret: string;
}

export interface SpotifyAuthDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface TokenResponse {
  access_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

/**
 * App-level Spotify access using the Client Credentials flow. The token lives
 * only in server memory; this flow has no refresh token, so a new one is
 * requested shortly before the current one expires.
 */
export class SpotifyAuth {
  private token: CachedToken | undefined;
  private pending: Promise<string> | undefined;

  constructor(
    private readonly credentials: SpotifyCredentials,
    private readonly deps: SpotifyAuthDeps = {},
  ) {}

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  /** Returns a valid access token, requesting one only when needed. */
  async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    // Concurrent callers share a single token request.
    this.pending ??= this.requestToken().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  /** Drops the cached token, e.g. after the API answers 401. */
  invalidate(): void {
    this.token = undefined;
  }

  private async requestToken(): Promise<string> {
    const { clientId, clientSecret } = this.credentials;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await request(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
      retries: 1,
      fetchImpl: this.deps.fetchImpl,
      sleep: this.deps.sleep,
    });

    if (!response.ok) {
      await response.body?.cancel();
      // Deliberately omits the response body and the credentials.
      throw new MusicError("PROVIDER_AUTH", `Spotify token request failed (${response.status})`);
    }

    const body = await readJson<TokenResponse>(response);
    if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
      throw new MusicError("PROVIDER_AUTH", "Spotify token response was malformed");
    }

    this.token = {
      value: body.access_token,
      expiresAt: this.now() + Math.max(0, body.expires_in * 1000 - EXPIRY_SKEW_MS),
    };
    return this.token.value;
  }
}

import type { MusicErrorCode } from "@/lib/music/errors";
import type { ProviderInfo, Track } from "@/lib/music/types";
import type { ResolvedKind } from "@/lib/search/resolve";

/** JSON contract shared by the API routes and the browser. */
export interface SearchSuccess {
  ok: true;
  kind: ResolvedKind;
  query: string;
  provider: ProviderInfo;
  tracks: Track[];
  nextOffset: number | null;
  total: number | null;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: MusicErrorCode;
    message: string;
    retryAfterSeconds?: number;
  };
}

export type SearchApiResponse = SearchSuccess | ApiFailure;

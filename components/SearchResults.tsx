"use client";

import { useEffect, useRef, useState } from "react";
import { useCopy } from "@/hooks/useCopy";
import type { SongSearch } from "@/hooks/useSongSearch";
import { ResultItem } from "./ResultItem";

interface SearchResultsProps {
  search: SongSearch;
  selectedId: string | null;
  onSelect: (trackId: string) => void;
}

/** Slightly longer than the CSS transition on `.result__reveal`. */
const COLLAPSE_MS = 420;

function Skeleton() {
  return (
    <ul className="results__list" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <li className="skeleton" key={row}>
          <span className="skeleton__art" />
          <span className="skeleton__lines">
            <span className="skeleton__line" />
            <span className="skeleton__line" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function statusText(search: SongSearch): string {
  if (search.status === "loading") return "Searching…";
  // Errors are announced by the alert below, so they are not repeated here.
  if (search.status !== "success" || !search.result) return "";
  const count = search.result.tracks.length;
  if (count === 0) return "No songs found.";
  const noun = count === 1 ? "recording" : "recordings";
  return `Showing ${count} ${noun} from ${search.result.provider.name}.`;
}

export function SearchResults({ search, selectedId, onSelect }: SearchResultsProps) {
  const { state: copyState, copy } = useCopy();

  // The row being left stays mounted just long enough to animate shut.
  const [closingId, setClosingId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function select(trackId: string) {
    if (trackId !== selectedId) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setClosingId(selectedId);
      closeTimer.current = setTimeout(() => setClosingId(null), COLLAPSE_MS);
    }
    onSelect(trackId);
  }
  const { status, result } = search;
  const tracks = result?.tracks ?? [];
  const loading = status === "loading";

  let copyAnnouncement = "";
  if (copyState) {
    copyAnnouncement = copyState.ok
      ? "Copied to clipboard."
      : "Copying failed. Select the code and copy it manually.";
  }

  if (status === "idle" && !result) {
    return <div className="visually-hidden" role="status" aria-live="polite" />;
  }

  return (
    <section className="results" aria-label="Search results" aria-busy={loading}>
      <p className="visually-hidden" role="status" aria-live="polite">
        {statusText(search)}
      </p>
      <p className="visually-hidden" role="status" aria-live="polite">
        {copyAnnouncement}
      </p>

      {status === "error" && (
        <div className="results__error" role="alert">
          <strong>We couldn&apos;t complete that search</strong>
          <p>{search.error}</p>
        </div>
      )}

      {loading && tracks.length === 0 && <Skeleton />}

      {status !== "error" && result && tracks.length === 0 && !loading && (
        <div className="results__empty">
          <strong>No songs found</strong>
          <p>
            Check the spelling, add the artist name, or paste the song&apos;s Spotify link or ISRC
            instead.
          </p>
        </div>
      )}

      {status !== "error" && result && tracks.length > 0 && (
        <>
          <div className="results__status">
            <span>
              {result.approximate
                ? "No exact match. Showing the closest results"
                : result.kind === "text"
                  ? "Select the correct recording"
                : result.kind === "isrc"
                  ? `Recordings with ISRC ${result.query}`
                  : "Exact match for your Spotify link"}
            </span>
            <span>Data from {result.provider.name}</span>
          </div>

          <ul className="results__list">
            {tracks.map((track, index) => (
              <ResultItem
                key={track.id}
                track={track}
                provider={result.provider}
                selected={track.id === selectedId}
                closing={track.id === closingId && track.id !== selectedId}
                onSelect={() => select(track.id)}
                copyState={copyState}
                onCopy={(text, key) => void copy(text, key)}
                priority={index < 4}
              />
            ))}
          </ul>

          {result.nextOffset !== null && (
            <button
              type="button"
              className="button button--text results__more"
              onClick={search.loadMore}
              aria-disabled={search.loadingMore}
              disabled={search.loadingMore}
            >
              {search.loadingMore ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Loading more…
                </>
              ) : (
                "Show more results"
              )}
            </button>
          )}
          {search.loadMoreError && (
            <p className="search__message" role="alert">
              {search.loadMoreError}
            </p>
          )}
        </>
      )}
    </section>
  );
}

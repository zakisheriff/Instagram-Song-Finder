"use client";

import Link from "next/link";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useSongSearch } from "@/hooks/useSongSearch";
import { SEARCH_INPUT_ID } from "@/lib/search/constants";
import { MAX_QUERY_LENGTH } from "@/lib/search/detect";
import { site } from "@/lib/site";
import { BrandMark } from "./BrandMark";
import { HeroCollage } from "./HeroCollage";
import { CloseIcon } from "./icons";
import { SearchResults } from "./SearchResults";


interface SongFinderProps {
  /** Server-rendered `<h1>` so the headline is in the initial HTML. */
  headline: ReactNode;
}

/**
 * The interactive top of the page: the hero on the left and the universal
 * search panel on the right, mirroring the two-column reference layout.
 */
export function SongFinder({ headline }: SongFinderProps) {
  const search = useSongSearch();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const messageId = useId();

  const tracks = search.result?.tracks ?? [];
  // The first recording is open by default; picking another one moves the selection.
  const selected = tracks.find((track) => track.id === pickedId) ?? tracks[0] ?? null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (search.canSubmit) search.submit();
  }

  return (
    <div className="split">
      <section className="hero" aria-labelledby="hero-headline">
        <Link className="hero__logo" href="/" aria-label={`${site.name} home`}>
          <BrandMark size={60} />
        </Link>
        <div className="hero__inner">
          <p className="hero__wordmark">
            <BrandMark size={28} />
            {site.name}
          </p>
          {headline}
          <HeroCollage track={selected} />
        </div>
      </section>

      <div className="split__divider" aria-hidden="true" />

      <section className="panel" aria-labelledby="panel-heading">
        <h2 className="panel__heading" id="panel-heading">
          {site.name}
        </h2>

        <form className="search" role="search" onSubmit={handleSubmit} noValidate>
          <div className={`field${search.inputError ? " field--error" : ""}`}>
            <input
              id={SEARCH_INPUT_ID}
              className="field__input"
              type="search"
              name="q"
              value={search.query}
              onChange={(event) => search.setQuery(event.target.value)}
              placeholder=" "
              maxLength={MAX_QUERY_LENGTH * 4}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              inputMode="search"
              aria-invalid={search.inputError ? true : undefined}
              aria-describedby={messageId}
            />
            <label className="field__label" htmlFor={SEARCH_INPUT_ID}>
              Song, artist, Spotify link or ISRC
            </label>
            {search.status === "loading" ? (
              <span className="field__action" aria-hidden="true">
                <span className="spinner" />
              </span>
            ) : (
              search.query.length > 0 && (
                <button
                  type="button"
                  className="field__action"
                  aria-label="Clear search"
                  onClick={() => {
                    search.clear();
                    document.getElementById(SEARCH_INPUT_ID)?.focus();
                  }}
                >
                  <CloseIcon size={16} />
                </button>
              )
            )}
          </div>

          <p className="search__message" id={messageId} role="alert">
            {search.inputError}
          </p>

          <button
            type="submit"
            className="button button--primary search__submit"
            aria-disabled={!search.canSubmit}
          >
            Search
          </button>

          <a className="button button--text search__help" href="#how-it-works">
            How does it work?
          </a>
        </form>

        <SearchResults
          search={search}
          selectedId={selected?.id ?? null}
          onSelect={setPickedId}
        />

        <p className="panel__byline">
          <span>from</span>
          <a href={site.publisher.url} target="_blank" rel="noopener">
            {site.publisher.name}
          </a>
        </p>
      </section>
    </div>
  );
}

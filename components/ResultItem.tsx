"use client";

import Image from "next/image";
import type { CopyState } from "@/hooks/useCopy";
import { formatArtists, formatDuration, trackMetaLine } from "@/lib/music/format";
import type { ProviderInfo, Track } from "@/lib/music/types";
import { formatInstagramIsrc, formatIsrcHyphenated } from "@/lib/search/isrc";
import { CheckIcon, ChevronIcon, ExternalIcon, NoteIcon, PauseIcon, PlayIcon } from "./icons";

/** Opens the app on phones that have it installed, the website elsewhere. */
const INSTAGRAM_URL = "https://www.instagram.com/";

interface ResultItemProps {
  track: Track;
  provider: ProviderInfo;
  selected: boolean;
  /** True for the row that was just deselected, while its panel animates shut. */
  closing?: boolean;
  onSelect: () => void;
  copyState: CopyState;
  onCopy: (text: string, key: string) => void;
  /** True while this recording's preview clip is playing. */
  playing?: boolean;
  /** True when this recording's preview clip could not be played. */
  previewFailed?: boolean;
  onTogglePreview?: () => void;
  /** Artwork for the first rows is fetched eagerly; the rest load lazily. */
  priority?: boolean;
}

export function ResultItem({
  track,
  provider,
  selected,
  closing = false,
  onSelect,
  copyState,
  onCopy,
  playing = false,
  previewFailed = false,
  onTogglePreview,
  priority = false,
}: ResultItemProps) {
  const domId = `result-${track.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const artists = formatArtists(track.artists);
  const meta = trackMetaLine(track);
  const instagramCode = track.isrc ? formatInstagramIsrc(track.isrc) : null;

  const instagramKey = `${track.id}:instagram`;
  const copiedInstagram = copyState?.key === instagramKey;

  // A short official clip from the catalog, so the visitor can confirm it's the right recording.
  const preview =
    track.previewUrl && onTogglePreview ? (
      <div className="preview">
        <button
          type="button"
          className={`button button--gray${playing ? " is-playing" : ""}`}
          aria-pressed={playing}
          onClick={onTogglePreview}
        >
          {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          {playing ? "Pause preview" : "Play preview"}
        </button>
        {previewFailed && (
          <p className="preview__caption" role="alert">
            This preview couldn&apos;t be played. Search again to refresh it.
          </p>
        )}
      </div>
    ) : null;

  // Spotify's terms ask for a link back wherever its metadata is shown; other
  // catalogs don't need one, so no button is offered for them.
  const sourceLink =
    provider.id === "spotify" && track.url ? (
      <a className="button button--gray" href={track.url} target="_blank" rel="noopener noreferrer">
        <ExternalIcon size={16} />
        Open in {provider.name}
      </a>
    ) : null;

  return (
    <li className={`result${selected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="result__row"
        aria-expanded={selected}
        aria-controls={`${domId}-detail`}
        // Selecting only ever opens a recording; the open one stays open.
        onClick={onSelect}
      >
        <span className="result__art">
          {track.artworkUrl ? (
            <Image
              src={track.artworkUrl}
              alt=""
              width={48}
              height={48}
              unoptimized
              loading={priority ? "eager" : "lazy"}
            />
          ) : (
            <NoteIcon size={20} />
          )}
        </span>
        <span className="result__text">
          <span className="result__title">
            {track.title}
            {track.explicit && <span className="result__tag">Explicit</span>}
            {track.versionTags.map((tag) => (
              <span className="result__tag" key={tag}>
                {tag}
              </span>
            ))}
          </span>
          <span className="result__artist">{artists}</span>
          {meta && <span className="result__meta">{meta}</span>}
        </span>
        <ChevronIcon className="result__chevron" size={16} />
      </button>

      {(selected || closing) && (
        <div
          className={`result__reveal${selected ? " is-open" : ""}`}
          id={`${domId}-detail`}
          inert={!selected}
          aria-hidden={!selected}
        >
          <div className="result__reveal-inner">
            <div className="result__detail">
          <dl className="result__facts">
            <dt>Song</dt>
            <dd>{track.title}</dd>
            <dt>Artist</dt>
            <dd>{artists}</dd>
            {track.album && (
              <>
                <dt>Album</dt>
                <dd>{track.album}</dd>
              </>
            )}
            {track.releaseDate && (
              <>
                <dt>Released</dt>
                <dd>{track.releaseDate}</dd>
              </>
            )}
            {track.durationMs !== null && (
              <>
                <dt>Length</dt>
                <dd>{formatDuration(track.durationMs)}</dd>
              </>
            )}
            <dt>ISRC</dt>
            <dd>{track.isrc ? formatIsrcHyphenated(track.isrc) : "Unavailable"}</dd>
          </dl>

          {instagramCode && track.isrc ? (
            <>
              <button
                type="button"
                className="code"
                aria-label={`Copy code ${instagramCode}`}
                onClick={() => onCopy(instagramCode, instagramKey)}
              >
                <span className="code__label">
                  {copiedInstagram && copyState?.ok ? "Copied to clipboard" : "Tap to copy for Instagram"}
                </span>
                <span className="code__value">{instagramCode}</span>
              </button>

              <div className="result__actions">
                {preview}

                <button
                  type="button"
                  className={`button button--primary${copiedInstagram && copyState?.ok ? " is-done" : ""}`}
                  onClick={() => onCopy(instagramCode, instagramKey)}
                >
                  {copiedInstagram && copyState?.ok ? (
                    <>
                      <CheckIcon size={16} />
                      Copied {instagramCode}
                    </>
                  ) : copiedInstagram ? (
                    "Couldn't copy. Select the code above instead"
                  ) : (
                    "Copy for Instagram"
                  )}
                </button>

                {/*
                  Instagram has no link that pre-fills its music search, so the
                  closest shortcut is to copy the code and open Instagram.
                */}
                <a
                  className="button button--gray"
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onCopy(instagramCode, instagramKey)}
                >
                  <ExternalIcon size={16} />
                  Copy and open Instagram
                </a>

                {sourceLink}
              </div>
            </>
          ) : (
            <>
              <div className="result__missing">
                <strong>ISRC unavailable for this recording.</strong>
                <p>
                  {provider.name} doesn&apos;t list a code for this release. Try another version of
                  the song from the results, or search again with the artist name to find a
                  release that includes one.
                </p>
              </div>
              {(preview || sourceLink) && (
                <div className="result__actions">
                  {preview}
                  {sourceLink}
                </div>
              )}
            </>
          )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

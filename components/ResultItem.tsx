"use client";

import Image from "next/image";
import type { CopyState } from "@/hooks/useCopy";
import { formatArtists, formatDuration, trackMetaLine } from "@/lib/music/format";
import type { ProviderInfo, Track } from "@/lib/music/types";
import { formatInstagramIsrc, formatIsrcHyphenated } from "@/lib/search/isrc";
import { CheckIcon, ChevronIcon, CopyIcon, ExternalIcon, NoteIcon } from "./icons";

interface ResultItemProps {
  track: Track;
  provider: ProviderInfo;
  selected: boolean;
  onSelect: () => void;
  copyState: CopyState;
  onCopy: (text: string, key: string) => void;
  /** Artwork for the first rows is fetched eagerly; the rest load lazily. */
  priority?: boolean;
}

export function ResultItem({
  track,
  provider,
  selected,
  onSelect,
  copyState,
  onCopy,
  priority = false,
}: ResultItemProps) {
  const domId = `result-${track.id.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const artists = formatArtists(track.artists);
  const meta = trackMetaLine(track);
  const instagramCode = track.isrc ? formatInstagramIsrc(track.isrc) : null;

  const instagramKey = `${track.id}:instagram`;
  const rawKey = `${track.id}:raw`;
  const copiedInstagram = copyState?.key === instagramKey;
  const copiedRaw = copyState?.key === rawKey;

  return (
    <li className={`result${selected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="result__row"
        aria-expanded={selected}
        aria-controls={`${domId}-detail`}
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

      {selected && (
        <div className="result__detail" id={`${domId}-detail`}>
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
              <div className="code">
                <span className="code__label" id={`${domId}-code-label`}>
                  Copy for Instagram
                </span>
                <span className="code__value" aria-labelledby={`${domId}-code-label`}>
                  {instagramCode}
                </span>
              </div>

              <div className="result__actions">
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

                {track.url && (
                  <a
                    className="button button--gray"
                    href={track.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalIcon size={16} />
                    Open in {provider.name}
                  </a>
                )}

                <button
                  type="button"
                  className="button button--outline"
                  onClick={() => onCopy(track.isrc!, rawKey)}
                >
                  {copiedRaw && copyState?.ok ? (
                    <>
                      <CheckIcon size={16} />
                      Copied {track.isrc}
                    </>
                  ) : (
                    <>
                      <CopyIcon size={16} />
                      Copy ISRC only
                    </>
                  )}
                </button>
              </div>

              <p className="result__note">
                Paste the code into Instagram&apos;s music search. An ISRC identifies this exact
                recording, but it doesn&apos;t guarantee the song is available on Instagram.
              </p>
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
              {track.url && (
                <div className="result__actions">
                  <a
                    className="button button--gray"
                    href={track.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalIcon size={16} />
                    Open in {provider.name}
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

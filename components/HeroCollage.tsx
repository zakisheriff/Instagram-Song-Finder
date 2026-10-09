import Image from "next/image";
import { formatArtists } from "@/lib/music/format";
import type { Track } from "@/lib/music/types";
import { formatInstagramIsrc } from "@/lib/search/isrc";
import { CheckIcon, CopyIcon, NoteIcon } from "./icons";
import { SiteLogo } from "./SiteLogo";

interface HeroCollageProps {
  /** The recording currently selected in the results, if any. */
  track: Track | null;
}

/**
 * The fanned card composition from the reference hero. It is purely
 * illustrative, so it is hidden from assistive technology; the same
 * information is available in the results list.
 */
export function HeroCollage({ track }: HeroCollageProps) {
  return (
    <div className="collage" aria-hidden="true">
      <div className="collage__card collage__card--left">
        <span className="collage__ghost-pill" />
      </div>
      <div className="collage__card collage__card--right">
        <span className="collage__ghost-pill" />
      </div>

      <div className={`collage__card collage__card--center${track ? " is-filled" : ""}`}>
        <div className="collage__progress">
          <span />
          <span />
        </div>
        <div className="collage__art">
          {track?.artworkUrl ? (
            <Image src={track.artworkUrl} alt="" width={300} height={300} unoptimized />
          ) : (
            <NoteIcon />
          )}
        </div>
        <p className="collage__title">{track ? track.title : "Your song"}</p>
        <p className="collage__artist">{track ? formatArtists(track.artists) : "Artist"}</p>
        <div className="collage__reply">
          <span className="collage__pill">
            {track?.isrc ? formatInstagramIsrc(track.isrc) : "isrc:"}
          </span>
          <CopyIcon />
        </div>
      </div>

      <span className="collage__bubble">
        <span className="gradient-text">isrc:</span>
      </span>
      <span className="collage__check">
        <CheckIcon />
      </span>
      <span className="collage__note">
        <SiteLogo size={72} />
      </span>
      <span className="collage__ring">
        <span>
          <NoteIcon />
        </span>
      </span>
    </div>
  );
}

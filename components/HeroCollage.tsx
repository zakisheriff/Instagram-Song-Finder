import Image from "next/image";

/** Intrinsic size of public/hero.webp; reserving it prevents layout shift. */
const HERO_WIDTH = 1390;
const HERO_HEIGHT = 1132;

/** The hero illustration shown beside the search panel on desktop. */
export function HeroCollage() {
  return (
    <Image
      className="collage"
      src="/hero.webp"
      alt="Instagram stories with a song added by pasting its isrc: code into music search"
      width={HERO_WIDTH}
      height={HERO_HEIGHT}
      sizes="(max-width: 875px) 1px, (max-width: 1400px) 48vw, 670px"
      priority
    />
  );
}

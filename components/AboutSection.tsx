import Link from "next/link";
import { facts } from "@/lib/content/links";
import { site } from "@/lib/site";

export function AboutSection() {
  return (
    <section className="content content--screen" id="about" aria-labelledby="about-title">
      <h2 className="content__title" id="about-title">
        About {site.name}
      </h2>
      <p className="content__lead">
        {site.name} is a free song discovery and ISRC lookup tool published by{" "}
        <a href={site.publisher.url} target="_blank" rel="noopener">
          {site.publisher.name}
        </a>
        . It needs no account and no sign-in, and it accepts song links from Spotify, Apple Music,
        YouTube, YouTube Music, Deezer and SoundCloud.
      </p>
      <ul className="cards cards--facts">
        {facts.map((fact) => (
          <li className="card" key={fact.title}>
            <h3>{fact.title}</h3>
            <p>{fact.detail}</p>
          </li>
        ))}
      </ul>

      <p>
        Song titles, artists, album artwork and ISRC codes come from Spotify&apos;s catalog where
        that integration is available. When it is not, results may come from Deezer&apos;s public
        catalog instead. Every result shows which source it came from, and codes are shown exactly
        as the catalog reports them. Nothing is guessed or generated.
      </p>
      <p>
        Finding an ISRC and finding a song on Instagram are two different things: this site does
        the first and helps with the second. Read more on the{" "}
        <Link href="/about">about page</Link>, or see{" "}
        <Link href="/#what-is-an-isrc">what an ISRC is</Link>.
      </p>
    </section>
  );
}

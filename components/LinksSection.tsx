import { supportedLinks } from "@/lib/content/links";

export function LinksSection() {
  return (
    <section className="content content--screen" id="supported-links" aria-labelledby="links-title">
      <h2 className="content__title" id="links-title">
        Find music by name or link
      </h2>
      <p className="content__lead">
        Type the song name, artist, or both to find the matching recording and its ISRC. Links from
        the supported music apps below work too.
      </p>

      <ul className="cards">
        {supportedLinks.map((link) => (
          <li className="card" key={link.service}>
            <h3>{link.service}</h3>
            <p className="card__tag">{link.match}</p>
            <p>{link.detail}</p>
          </li>
        ))}
      </ul>

      <p className="callout">
        <strong>Not supported:</strong> Tidal and Amazon Music links, because those services
        don&apos;t share a song&apos;s details publicly. Links to albums, playlists and artists
        don&apos;t work either, since an ISRC belongs to one recording. Search by title and artist
        instead.
      </p>
    </section>
  );
}

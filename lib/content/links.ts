export interface SupportedLink {
  service: string;
  /** How precisely a link from this service identifies the recording. */
  match: string;
  detail: string;
}

export const supportedLinks: SupportedLink[] = [
  {
    service: "Spotify",
    match: "Exact recording",
    detail: "Track links, share links and spotify:track: URIs. Tracking parameters are ignored.",
  },
  {
    service: "Deezer",
    match: "Exact recording",
    detail: "Any deezer.com track link returns that recording and its ISRC directly.",
  },
  {
    service: "Apple Music",
    match: "Matched by title, artist and length",
    detail: "Use a song link, or an album link that points at one song.",
  },
  {
    service: "YouTube",
    match: "Title search",
    detail: "The video title is cleaned up and searched. You pick the right recording.",
  },
  {
    service: "YouTube Music",
    match: "Title search",
    detail: "Works the same way as a YouTube link, including shared links.",
  },
  {
    service: "SoundCloud",
    match: "Title search",
    detail: "The track title and uploader are searched. You pick the right recording.",
  },
];

export interface Fact {
  title: string;
  detail: string;
}

export const facts: Fact[] = [
  { title: "Free", detail: "No paywall, no trial and no limits on how many songs you look up." },
  { title: "No account", detail: "Nothing to sign up for, and it never asks for your Instagram or Spotify login." },
  { title: "Real catalog data", detail: "Codes come straight from music catalogs. Nothing is guessed or generated." },
  { title: "One tap to copy", detail: "The code is copied with the isrc: prefix already added, ready to paste." },
  { title: "Typo friendly", detail: "Misspell the title or the artist and it still finds the song you meant." },
];

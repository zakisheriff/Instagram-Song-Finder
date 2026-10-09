export interface FaqEntry {
  /** Used as the anchor, e.g. `/#what-is-an-isrc`. */
  id: string;
  question: string;
  /** One paragraph per entry; the first sentence answers the question directly. */
  answer: string[];
}

export const faqEntries: FaqEntry[] = [
  {
    id: "what-is-instagram-song-finder",
    question: "What is Instagram Song Finder?",
    answer: [
      "Instagram Song Finder is a free web tool by The Atom that looks up the ISRC code of a song and formats it for Instagram's music search. You search by song title, artist, Spotify link or an existing ISRC, pick the right recording, and copy a ready-to-paste string such as isrc:USUM72409273.",
      "It is an independent tool. It is not made by, affiliated with or endorsed by Instagram, Meta or Spotify.",
    ],
  },
  {
    id: "how-do-i-find-a-song-on-instagram",
    question: "How do I find a song on Instagram?",
    answer: [
      "Open the music picker in a Story or Reel and search for the song by name, or paste its ISRC with the isrc: prefix to look for one exact recording. Searching by name often returns covers, remixes and sped-up edits first, so an ISRC search is a more precise way to ask for the original version.",
      "Use the search box at the top of this page to get the code, then paste it into Instagram's music search.",
    ],
  },
  {
    id: "how-can-i-find-an-isrc-code-from-spotify",
    question: "How can I find an ISRC code from Spotify?",
    answer: [
      "Paste a Spotify track link into Instagram Song Finder and it returns the ISRC that Spotify's catalog lists for that exact track. The Spotify app does not display ISRC codes itself, so a lookup tool that reads Spotify's catalog data is the quickest route.",
      "In Spotify, open the song, choose Share, then Copy Song Link, and paste that link here.",
    ],
  },
  {
    id: "can-i-search-using-a-spotify-song-link",
    question: "Can I search using a Spotify song link?",
    answer: [
      "Yes. Paste a full open.spotify.com track link, a spotify.link share link or a spotify:track: URI into the same search box. Tracking parameters such as ?si= are ignored, and the lookup returns that exact recording rather than a list of similar songs.",
      "Links to albums, playlists, artists and podcasts are not supported, because an ISRC belongs to a single recording.",
    ],
  },
  {
    id: "what-is-an-isrc",
    question: "What is an ISRC?",
    answer: [
      "An ISRC, or International Standard Recording Code, is a 12-character identifier assigned to one specific sound recording. It is defined by the ISO 3901 standard and looks like USUM72409273, sometimes written with hyphens as US-UM7-24-09273.",
      "Labels and distributors assign the code when a recording is released, and streaming services, radio and rights organisations use it to tell recordings apart and report plays.",
    ],
  },
  {
    id: "how-do-i-copy-an-isrc-for-instagram",
    question: "How do I copy an ISRC for Instagram?",
    answer: [
      "Search for the song, select the correct recording and press Copy for Instagram. That copies the full string including the prefix, for example isrc:USUM72409273, so you can paste it straight into Instagram's music search without editing it.",
      "Copy and open Instagram does the same and then opens Instagram, where you paste the code into the music search yourself.",
    ],
  },
  {
    id: "why-cant-i-find-a-song-on-instagram",
    question: "Why can't I find a song on Instagram?",
    answer: [
      "Usually because Instagram has not licensed that recording for your account or region. Instagram's music library depends on agreements with rights holders, so availability differs between countries, and business accounts often see a smaller library than personal and creator accounts.",
      "A correct ISRC cannot change that. If a search by ISRC returns nothing, try another official version of the song, or check whether the track is available to other accounts in your region.",
    ],
  },
  {
    id: "does-every-spotify-song-exist-on-instagram",
    question: "Does every Spotify song exist on Instagram?",
    answer: [
      "No. Spotify and Instagram license music separately, so a song can be on Spotify and missing from Instagram, or the other way round. Instagram Song Finder tells you a recording's ISRC; it cannot tell you whether Instagram carries that recording, and there is no public Instagram service that reports it.",
    ],
  },
  {
    id: "are-isrc-codes-unique-to-songs",
    question: "Are ISRC codes unique to songs?",
    answer: [
      "ISRC codes are unique to recordings, not to songs. One song can have many ISRCs, because the original studio version, a live take, a remaster, a remix, a radio edit and a sped-up edit are all different recordings.",
      "The reverse also happens: the same recording normally keeps one ISRC wherever it appears, so a single and the album it later lands on can share a code.",
    ],
  },
  {
    id: "how-do-i-find-the-exact-version-of-a-song",
    question: "How do I find the exact version of a song?",
    answer: [
      "Compare the details shown with each result: artist, album, release year, length and labels such as Live, Remastered, Remix or Sped up. Each recording is listed separately with its own ISRC and results are never merged, so you can pick the one that matches what you want.",
      "The most reliable method is to open the exact track in Spotify, copy its link and paste it here, which returns that recording and no other.",
    ],
  },
];

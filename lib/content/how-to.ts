export interface HowToStep {
  title: string;
  detail: string;
}

export const howToSteps: HowToStep[] = [
  {
    title: "Search for the song or paste its link",
    detail:
      "Type a title, an artist, a few keywords or an ISRC into the search box, or paste a song link from Spotify, Apple Music, YouTube, YouTube Music, Deezer or SoundCloud.",
  },
  {
    title: "Select the correct recording",
    detail:
      "Check the artist, album, year and length. Live, remastered, remixed and sped-up versions are separate recordings with separate codes.",
  },
  {
    title: "Copy the generated isrc: string",
    detail:
      "Press Copy for Instagram to copy the complete string, in the form isrc:XXXXXXXXXXXX, including the prefix.",
  },
  {
    title: "Open Instagram",
    detail: "Use the Instagram app on your phone, signed in to the account you post from.",
  },
  {
    title: "Open the music search",
    detail:
      "Start a Story or a Reel and open the music picker: the music sticker in Stories, or Audio when editing a Reel.",
  },
  {
    title: "Paste the copied string into music search",
    detail: "Paste it exactly as copied. Don't add spaces or remove the isrc: prefix.",
  },
  {
    title: "Select the song if Instagram returns the matching recording",
    detail:
      "If the recording is in Instagram's library for your account and region, it appears in the results and you can add it as usual.",
  },
];

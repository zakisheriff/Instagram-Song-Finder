import type { Track } from "@/lib/music/types";

/** Lower-cases, strips accents and punctuation, and splits into words. */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Classic edit distance: insertions, deletions and substitutions. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** 1 for identical words, falling towards 0 as more characters differ. */
function wordSimilarity(queryWord: string, candidate: string): number {
  if (queryWord === candidate) return 1;
  // Someone still typing ("smi" for "smile") counts as a match.
  if (queryWord.length >= 3 && candidate.startsWith(queryWord)) return 1;
  const longest = Math.max(queryWord.length, candidate.length);
  return 1 - editDistance(queryWord, candidate) / longest;
}

/**
 * How well a recording matches what was typed, from 0 to 1: the average, over
 * the query's words, of the closest word in the title, artists and album.
 */
export function trackSimilarity(query: string, track: Track): number {
  const queryWords = tokenize(query);
  if (queryWords.length === 0) return 0;
  const candidates = tokenize([track.title, ...track.artists, track.album ?? ""].join(" "));
  if (candidates.length === 0) return 0;
  const total = queryWords.reduce(
    (sum, word) => sum + Math.max(...candidates.map((candidate) => wordSimilarity(word, candidate))),
    0,
  );
  return total / queryWords.length;
}

/** Number of leading results considered when judging a page. */
const PAGE_SAMPLE = 5;

/** The best match among the first few results of a page. */
export function pageSimilarity(query: string, tracks: Track[]): number {
  return tracks
    .slice(0, PAGE_SAMPLE)
    .reduce((best, track) => Math.max(best, trackSimilarity(query, track)), 0);
}

/** Most variants tried when a query finds nothing at all. */
const MAX_VARIANTS = 4;

/**
 * Looser versions of a query for when it finds nothing: each one leaves out a
 * single word, longest words kept first, so one unrecognisable word doesn't
 * sink the whole search.
 */
export function relaxedQueries(query: string): string[] {
  const words = query.split(" ").filter(Boolean);
  if (words.length < 2) return [];
  const variants = words.map((_, skipped) => words.filter((__, index) => index !== skipped).join(" "));
  return [...new Set(variants)]
    .filter((variant) => variant.length >= 2 && variant !== query)
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_VARIANTS);
}

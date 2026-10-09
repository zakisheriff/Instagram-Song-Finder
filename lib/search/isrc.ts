/**
 * ISRC (International Standard Recording Code) helpers.
 *
 * An ISRC is 12 characters: a 2-letter prefix, a 3-character alphanumeric
 * registrant code, a 2-digit year of reference and a 5-digit designation.
 * It is commonly written with hyphens, e.g. `US-UM7-24-09273`.
 */

const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

/** Shape of a single token that was clearly meant to be an ISRC, valid or not. */
const ISRC_LIKE_PATTERN = /^[A-Z]{2}-?[A-Z0-9]{3}-?\d{2}-?\d+$/;

export const INSTAGRAM_ISRC_PREFIX = "isrc:";

/** Uppercases and strips the separators people commonly type inside an ISRC. */
export function normalizeIsrc(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIsrc(value: string): boolean {
  return ISRC_PATTERN.test(value);
}

/** Returns the normalized ISRC, or `null` when the value is not a valid ISRC. */
export function parseIsrc(value: string): string | null {
  const normalized = normalizeIsrc(value);
  return isValidIsrc(normalized) ? normalized : null;
}

/** True for a single token that looks like an attempt at an ISRC. */
export function looksLikeIsrc(value: string): boolean {
  const trimmed = value.trim().toUpperCase();
  return !/\s/.test(trimmed) && ISRC_LIKE_PATTERN.test(trimmed);
}

/** The exact string to paste into Instagram's music search, e.g. `isrc:USUM72409273`. */
export function formatInstagramIsrc(isrc: string): string {
  return `${INSTAGRAM_ISRC_PREFIX}${normalizeIsrc(isrc)}`;
}

/** Human-readable hyphenated form, e.g. `US-UM7-24-09273`. */
export function formatIsrcHyphenated(isrc: string): string {
  const value = normalizeIsrc(isrc);
  if (!isValidIsrc(value)) return value;
  return `${value.slice(0, 2)}-${value.slice(2, 5)}-${value.slice(5, 7)}-${value.slice(7)}`;
}

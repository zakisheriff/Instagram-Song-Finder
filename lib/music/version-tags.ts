/**
 * Detects wording that marks a recording as a distinct version. Different
 * versions of a song are different sound recordings and normally carry
 * different ISRCs, so the interface surfaces these labels instead of merging
 * similar-looking results.
 */
const VERSION_RULES: ReadonlyArray<readonly [label: string, pattern: RegExp]> = [
  ["Live", /\blive\b/i],
  ["Remastered", /\bremaster(ed)?\b/i],
  ["Sped up", /\bsped[\s-]?up\b|\bnightcore\b/i],
  ["Slowed", /\bslowed\b/i],
  ["Remix", /\bremix(ed)?\b|\bmix\)/i],
  ["Acoustic", /\bacoustic\b|\bunplugged\b|\bstripped\b/i],
  ["Instrumental", /\binstrumental\b/i],
  ["Karaoke", /\bkaraoke\b/i],
  ["Radio edit", /\bradio (edit|version)\b/i],
  ["Extended", /\bextended\b/i],
  ["Demo", /\bdemo\b/i],
  ["Re-recorded", /\bre-?record(ed|ing)\b|\b\w+['’]s version\b/i],
  ["Cover", /\bcover\b|\btribute\b/i],
];

/** Only text inside brackets or after a dash is inspected, so "Live Forever" isn't tagged as live. */
function qualifiers(title: string): string {
  const bracketed = title.match(/[([][^)\]]*[)\]]/g) ?? [];
  const dashIndex = title.search(/\s[-–—]\s/);
  const afterDash = dashIndex >= 0 ? title.slice(dashIndex) : "";
  return [...bracketed, afterDash].join(" ");
}

export function detectVersionTags(title: string): string[] {
  const text = qualifiers(title);
  if (!text) return [];
  return VERSION_RULES.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

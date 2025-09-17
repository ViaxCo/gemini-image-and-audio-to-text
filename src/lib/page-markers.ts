/**
 * Extracts unique page markers from the provided text.
 * Assumes markers follow the pattern "Page <number>" with optional punctuation
 * immediately after the keyword. Returns normalized results in ascending order.
 */
export function extractPageMarkers(text: string): {
  count: number;
  pages: number[];
} {
  if (!text) {
    return { count: 0, pages: [] };
  }

  const pattern = /\bPage\s*(?:[#.:-]?\s*)?(\d{1,5})\b/gi;
  const unique = new Set<number>();
  let match: RegExpExecArray | null = pattern.exec(text);

  while (match) {
    const raw = match[1];
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      unique.add(parsed);
    }
    match = pattern.exec(text);
  }

  const pages = Array.from(unique).sort((a, b) => a - b);
  return { count: pages.length, pages };
}

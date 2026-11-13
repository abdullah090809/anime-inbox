// Finds anime in OCR text. The search function is passed in so this stays testable.
import type { Anime, Candidate, OcrLine } from '../types';
import { bestNameScore } from './match';
import { rankQueries } from './candidates';

export const MIN_MATCH = 0.72;
export const PRESELECT = 0.8;

export async function analyzeLines(
  lines: OcrLine[],
  imgW: number,
  imgH: number,
  search: (q: string) => Promise<Anime[]>,
  maxQueries = 6,
): Promise<Candidate[]> {
  const queries = rankQueries(lines, imgW, imgH).slice(0, maxQueries);
  const found = new Map<number, Candidate>();

  for (const q of queries) {
    let results: Anime[] = [];
    try {
      results = await search(q.text);
    } catch {
      continue;
    }
    const scored = results
      .slice(0, 6)
      .map((a) => ({ a, s: bestNameScore(q.text, a) }))
      .filter((x) => x.s >= MIN_MATCH)
      .sort((x, y) => y.s - x.s)
      .slice(0, 2);

    scored.forEach((x, rank) => {
      // 'prior' = how title-like the text looked; 's' = how well it matched the result.
      const confidence = Math.min(1, x.s * (0.75 + 0.25 * q.prior));
      const old = found.get(x.a.malId);
      // Only the best result of each query can be pre-ticked, so sequels do not all get selected.
      const selected = rank === 0 && confidence >= PRESELECT;
      if (!old || old.confidence < confidence) {
        found.set(x.a.malId, {
          malId: x.a.malId,
          anime: x.a,
          confidence,
          source: 'text',
          matchedText: q.text,
          selected: selected || (old ? old.selected : false),
        });
      } else if (selected) {
        old.selected = true;
      }
    });
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}

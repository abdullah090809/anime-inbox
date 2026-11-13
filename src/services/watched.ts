// Your own "watched" list: import a .txt file, match each title to MyAnimeList, keep your ratings.
import * as DocumentPicker from 'expo-document-picker';
import type { WatchedItem } from '../types';
import { getState, patchWatched, setWatched } from '../store';
import { uid } from './ids';
import { readText } from './files';
import { normKey, parseWatchedText } from './watchedParse';
import { searchAnime } from './jikan';
import { bestNameScore } from './match';

export type ImportSummary = { total: number; added: number; updated: number; same: number };

// Opens the file picker, reads the list and merges it in. Importing again later only adds new titles
// (and updates a rating if you changed it); nothing is removed.
export async function importWatchedFile(): Promise<ImportSummary | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets || !res.assets.length) return null;
  const text = await readText(res.assets[0].uri);
  const parsed = parseWatchedText(text);

  const items: WatchedItem[] = [...getState().watched];
  const byKey = new Map<string, number>();
  items.forEach((w, i) => byKey.set(normKey(w.name), i));

  let added = 0;
  let updated = 0;
  let same = 0;
  for (const p of parsed) {
    const key = normKey(p.name);
    const at = byKey.get(key);
    if (at === undefined) {
      items.push({ id: uid(), name: p.name, rating: p.rating, status: 'todo', malId: null, anime: null });
      byKey.set(key, items.length - 1);
      added++;
    } else if (p.rating !== null && items[at].rating !== p.rating) {
      items[at] = { ...items[at], rating: p.rating };
      updated++;
    } else {
      same++;
    }
  }
  setWatched(items);
  return { total: parsed.length, added, updated, same };
}

// Looks each unmatched title up on MyAnimeList (about one per second - MAL limits requests).
// Safe to stop and start again: it only touches titles that are still 'todo'.
export async function matchWatched(
  shouldStop: () => boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const todo = getState().watched.filter((w) => w.status === 'todo');
  let failures = 0;
  for (let i = 0; i < todo.length; i++) {
    if (shouldStop()) return;
    const w = todo[i];
    try {
      const results = await searchAnime(w.name, { adult: true, limit: 4 });
      const best = results
        .map((a) => ({ a, s: bestNameScore(w.name, a) }))
        .sort((x, y) => y.s - x.s)[0];
      if (best && best.s >= 0.8) patchWatched(w.id, { status: 'matched', malId: best.a.malId, anime: best.a });
      else patchWatched(w.id, { status: 'unmatched' });
      failures = 0;
    } catch {
      failures++;
      if (failures >= 3) throw new Error("Couldn't reach MyAnimeList. Check your connection and tap Resume.");
    }
    if (onProgress) onProgress(i + 1, todo.length);
  }
}

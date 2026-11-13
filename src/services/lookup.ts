// Helpers for the "already in your list" and "you already watched this" warnings.
import type { Anime, Entry, WatchedItem } from '../types';
import { bestNameScore } from './match';

export type WatchedIndex = { byMal: Map<number, WatchedItem>; unmatched: WatchedItem[] };

export function indexWatched(watched: WatchedItem[]): WatchedIndex {
  const byMal = new Map<number, WatchedItem>();
  const unmatched: WatchedItem[] = [];
  for (const w of watched) {
    if (w.malId) byMal.set(w.malId, w);
    else unmatched.push(w);
  }
  return { byMal, unmatched };
}

// Matches by MyAnimeList ID first. Titles that could not be matched during import are compared by name.
export function findWatched(idx: WatchedIndex, anime: Anime): WatchedItem | null {
  const direct = idx.byMal.get(anime.malId);
  if (direct) return direct;
  for (const w of idx.unmatched) {
    if (bestNameScore(w.name, anime) >= 0.9) return w;
  }
  return null;
}

export function entryKey(listId: string, malId: number): string {
  return listId + ':' + malId;
}

export function indexEntries(entries: Entry[]): Map<string, Entry> {
  const m = new Map<string, Entry>();
  for (const e of entries) m.set(entryKey(e.listId, e.anime.malId), e);
  return m;
}

export function ratingText(r: number | null): string {
  if (r === null || r === undefined) return '';
  return String(Number(r.toFixed(1))) + '/5';
}

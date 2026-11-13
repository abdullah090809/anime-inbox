// Fuzzy title matching. Pure functions - no React Native imports, so it can be tested with node.
import type { Anime } from '../types';

export function normalize(input: string): string {
  let s = (input || '').normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.toLowerCase().replace(/&/g, ' and ').replace(/['’`]/g, '');
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  s = s.replace(/^the /, '');
  return s;
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

export function levRatio(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
}

function tokenSort(s: string): string {
  return s.split(' ').sort().join(' ');
}

// Best match of the shorter string against any run of words in the longer one.
export function partialRatio(shortS: string, longS: string): number {
  const st = shortS.split(' ');
  const lt = longS.split(' ');
  if (st.length >= lt.length) return levRatio(shortS, longS);
  let best = 0;
  for (const k of [st.length - 1, st.length, st.length + 1]) {
    if (k < 1 || k > lt.length) continue;
    for (let i = 0; i + k <= lt.length; i++) {
      best = Math.max(best, levRatio(shortS, lt.slice(i, i + k).join(' ')));
    }
  }
  return best;
}

// 0..1. Short single-word strings never match by containment, so "Shadow" does not match
// "The Eminence in Shadow" (that was a bug in the old Flask version).
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  let score = levRatio(na, nb);
  score = Math.max(score, levRatio(tokenSort(na), tokenSort(nb)) * 0.98);
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  const shortTokens = shorter.split(' ').length;
  if (shortTokens >= 3 || shorter.length >= 14) {
    const lenRatio = shorter.length / longer.length;
    if (lenRatio >= 0.35) {
      const weight = 0.82 + 0.18 * Math.min(1, lenRatio / 0.8);
      score = Math.max(score, partialRatio(shorter, longer) * weight);
    }
  }
  return Math.min(1, score);
}

export function animeNames(a: Anime): string[] {
  const out: string[] = [];
  for (const n of [a.title, a.titleEnglish, a.titleJapanese, ...(a.synonyms || [])]) {
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export function bestNameScore(query: string, a: Anime): number {
  let best = 0;
  for (const n of animeNames(a)) best = Math.max(best, similarity(query, n));
  return best;
}

// Display name: English if there is one, otherwise the MAL title.
export function displayName(a: Anime): string {
  return a.titleEnglish || a.title;
}

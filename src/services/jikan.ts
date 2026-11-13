// MyAnimeList lookups through Jikan (an unofficial MAL API).
// Jikan allows about 3 requests per second and 60 per minute, so every call waits its turn.
import type { Anime } from '../types';
import { sleep } from './ids';

const BASE = 'https://api.jikan.moe/v4';

let chain: Promise<unknown> = Promise.resolve();
let lastStart = 0;
const recent: number[] = [];

async function waitTurn(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (recent.length && now - recent[0] > 60000) recent.shift();
    const gap = now - lastStart;
    if (gap < 450) {
      await sleep(450 - gap);
      continue;
    }
    if (recent.length >= 50) {
      await sleep(Math.max(200, 60000 - (now - recent[0]) + 50));
      continue;
    }
    lastStart = now;
    recent.push(now);
    return;
  }
}

async function fetchJson(url: string): Promise<any> {
  const run = async (): Promise<any> => {
    let lastErr: unknown = new Error('Request failed');
    for (let attempt = 1; attempt <= 3; attempt++) {
      await waitTurn();
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 15000) : null;
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined });
        if (timer) clearTimeout(timer);
        if (res.status === 429) {
          await sleep(2500 * attempt);
          lastErr = new Error('MyAnimeList is busy (rate limit)');
          continue;
        }
        if (res.status >= 500) {
          await sleep(1500 * attempt);
          lastErr = new Error('MyAnimeList error ' + res.status);
          continue;
        }
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('MyAnimeList error ' + res.status);
        return await res.json();
      } catch (e) {
        if (timer) clearTimeout(timer);
        lastErr = e;
        await sleep(800 * attempt);
      }
    }
    throw lastErr;
  };
  // one request at a time, in order
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

function mapAnime(d: any): Anime {
  const titles: { type?: string; title?: string }[] = Array.isArray(d.titles) ? d.titles : [];
  const english =
    d.title_english || (titles.find((t) => t.type === 'English') || {}).title || null;
  const japanese =
    d.title_japanese || (titles.find((t) => t.type === 'Japanese') || {}).title || null;
  const syn: string[] = [];
  const main = String(d.title || '');
  for (const s of [...(d.title_synonyms || []), ...titles.map((t) => t.title || '')]) {
    if (s && s !== main && s !== english && s !== japanese && !syn.includes(s)) syn.push(s);
  }
  return {
    malId: Number(d.mal_id),
    title: main,
    titleEnglish: english,
    titleJapanese: japanese,
    synonyms: syn.slice(0, 10),
    score: typeof d.score === 'number' ? d.score : null,
    genres: Array.isArray(d.genres) ? d.genres.map((g: any) => String(g.name)) : [],
    posterUrl: (d.images && ((d.images.jpg && d.images.jpg.image_url) || (d.images.webp && d.images.webp.image_url))) || null,
    year: d.year || (d.aired && d.aired.prop && d.aired.prop.from && d.aired.prop.from.year) || null,
    episodes: typeof d.episodes === 'number' ? d.episodes : null,
  };
}

const cache = new Map<string, Anime[]>();

export async function searchAnime(
  query: string,
  opts: { adult?: boolean; limit?: number } = {},
): Promise<Anime[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const limit = opts.limit || 6;
  const key = (opts.adult ? 'a:' : 's:') + limit + ':' + q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const url = BASE + '/anime?q=' + encodeURIComponent(q.slice(0, 120)) + '&limit=' + limit + (opts.adult ? '' : '&sfw=true');
  const json = await fetchJson(url);
  const list: Anime[] = json && Array.isArray(json.data) ? json.data.map(mapAnime) : [];
  cache.set(key, list);
  return list;
}

export async function getAnimeById(malId: number): Promise<Anime | null> {
  const json = await fetchJson(BASE + '/anime/' + malId);
  return json && json.data ? mapAnime(json.data) : null;
}

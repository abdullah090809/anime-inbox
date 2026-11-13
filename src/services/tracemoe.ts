// Scene identification through trace.moe (matches a picture to an anime frame).
// The free tier is small (about 100 searches a month at the time of writing, shared by everyone
// on the same network), so the app counts its own use and can take your own API key.

export class SceneQuotaError extends Error {
  constructor() {
    super('The free scene-search limit has been reached');
    this.name = 'SceneQuotaError';
  }
}

export type SceneHit = {
  malId: number | null;
  titles: string[];
  similarity: number; // 0..1
  episode: number | null;
};

export async function identifyScene(jpegUri: string, apiKey: string): Promise<SceneHit[]> {
  const form = new FormData();
  form.append('image', { uri: jpegUri, name: 'scene.jpg', type: 'image/jpeg' } as any);
  const headers: Record<string, string> = {};
  if (apiKey) headers['x-trace-key'] = apiKey;

  const res = await fetch('https://api.trace.moe/search?anilistInfo&cutBorders', {
    method: 'POST',
    body: form,
    headers,
  });
  if (res.status === 402 || res.status === 429) throw new SceneQuotaError();
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw new Error('Scene search returned something unexpected');
  }
  if (!res.ok || (json && json.error)) {
    throw new Error((json && json.error) || 'Scene search failed (' + res.status + ')');
  }
  const out: SceneHit[] = [];
  for (const r of (json && json.result) || []) {
    const a = r.anilist && typeof r.anilist === 'object' ? r.anilist : null;
    const titles: string[] = [];
    if (a && a.title) {
      for (const t of [a.title.english, a.title.romaji, a.title.native]) if (t && !titles.includes(t)) titles.push(t);
    }
    out.push({
      malId: a && a.idMal ? Number(a.idMal) : null,
      titles,
      similarity: typeof r.similarity === 'number' ? r.similarity : 0,
      episode: typeof r.episode === 'number' ? r.episode : null,
    });
  }
  return out;
}

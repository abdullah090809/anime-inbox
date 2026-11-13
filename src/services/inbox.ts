// The screenshot pipeline: pick up shared screenshots, read them, look the anime up, and save.
import * as ImagePicker from 'expo-image-picker';
import type { Anime, Candidate, PendingShot } from '../types';
import {
  addEntries,
  claimShot,
  flushSaves,
  getState,
  putPending,
  removePending,
  setSettings,
} from '../store';
import { uid } from './ids';
import { INBOX, SHOTS, THUMBS, copyFile, deleteFile, ensureDirs, info, listDir, moveFile } from './files';
import { imageSize, ocrAvailable, recognize } from './ocr';
import { analyzeLines } from './analyze';
import { getAnimeById, searchAnime } from './jikan';
import { SceneQuotaError, identifyScene } from './tracemoe';
import type { SceneHit } from './tracemoe';
import { cropToJpeg, resizeToJpeg } from './image';
import { bestNameScore } from './match';

const IMG_RE = /\.(jpe?g|png|webp)$/i;

// ---------- getting screenshots in ----------

// Copies made by the silent share target land in files/inbox. Move them into the app's queue.
export async function scanInbox(): Promise<number> {
  await ensureDirs();
  const names = await listDir(INBOX);
  let added = 0;
  for (const name of names) {
    if (!IMG_RE.test(name)) continue;
    const from = INBOX + name;
    const st = await info(from);
    if (!st.exists) continue;
    // skip a file that is still being written
    if (st.modificationTime && Date.now() / 1000 - st.modificationTime < 3) continue;
    const id = uid();
    const ext = (name.split('.').pop() || 'jpg').toLowerCase();
    const to = SHOTS + id + '.' + ext;
    try {
      await moveFile(from, to);
    } catch {
      continue;
    }
    await putPending(newShot(id, to, 0, 0));
    added++;
  }
  return added;
}

function newShot(id: string, uri: string, width: number, height: number): PendingShot {
  return {
    id,
    uri,
    addedAt: Date.now(),
    status: 'queued',
    candidates: [],
    lines: [],
    width,
    height,
    sceneTried: false,
  };
}

// "Import from gallery": the originals are never touched - the app copies what you pick.
export async function importFromGallery(): Promise<number> {
  await ensureDirs();
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    quality: 1,
  } as any);
  if (res.canceled || !res.assets) return 0;
  let added = 0;
  for (const asset of res.assets) {
    const mime = (asset as any).mimeType || '';
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const id = uid();
    const to = SHOTS + id + '.' + ext;
    try {
      await copyFile(asset.uri, to);
      await putPending(newShot(id, to, asset.width || 0, asset.height || 0));
      added++;
    } catch {
      // skip this one
    }
  }
  return added;
}

// ---------- scene search quota ----------

export function traceMonth(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function sceneUsed(): number {
  const u = getState().settings.traceUsage;
  return u.month === traceMonth() ? u.count : 0;
}

export function sceneAllowed(): boolean {
  const s = getState().settings;
  return !!s.traceKey || sceneUsed() < 95;
}

function bumpScene() {
  const s = getState().settings;
  const m = traceMonth();
  const count = (s.traceUsage.month === m ? s.traceUsage.count : 0) + 1;
  setSettings({ traceUsage: { month: m, count } });
}

// ---------- reading a screenshot ----------

function mergeCandidates(existing: Candidate[], extra: Candidate[]): Candidate[] {
  const out = [...existing];
  for (const c of extra) if (!out.some((x) => x.malId === c.malId)) out.push(c);
  return out;
}

async function hitsToCandidates(hits: SceneHit[]): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const good = hits.filter((h) => h.similarity >= 0.8).slice(0, 3);
  for (let i = 0; i < good.length; i++) {
    const h = good[i];
    let anime: Anime | null = null;
    try {
      if (h.malId) anime = await getAnimeById(h.malId);
    } catch {
      anime = null;
    }
    if (!anime) {
      for (const t of h.titles) {
        try {
          const r = await searchAnime(t, { adult: true, limit: 3 });
          const best = r.map((a) => ({ a, s: bestNameScore(t, a) })).sort((x, y) => y.s - x.s)[0];
          if (best && best.s >= 0.85) {
            anime = best.a;
            break;
          }
        } catch {
          // try the next title
        }
      }
    }
    if (!anime || out.some((c) => c.malId === anime!.malId)) continue;
    out.push({
      malId: anime.malId,
      anime,
      confidence: h.similarity,
      source: 'scene',
      matchedText: h.episode ? 'Episode ' + h.episode : undefined,
      selected: i === 0 && h.similarity >= 0.92,
    });
  }
  return out;
}

// Looks at the picture itself. `rect` is a box in 0..1 image coordinates; no box = whole image.
export async function runScene(
  shotId: string,
  rect?: { x: number; y: number; w: number; h: number },
): Promise<{ added: number }> {
  const shot = getState().pending.find((p) => p.id === shotId);
  if (!shot) throw new Error('Screenshot not found');
  const s = getState().settings;
  if (!sceneAllowed()) throw new SceneQuotaError();

  let w = shot.width;
  let h = shot.height;
  if (!w || !h) {
    const sz = await imageSize(shot.uri);
    w = sz.width;
    h = sz.height;
  }
  const prepared = rect
    ? await cropToJpeg(shot.uri, { x: rect.x * w, y: rect.y * h, w: rect.w * w, h: rect.h * h })
    : await resizeToJpeg(shot.uri, 640, 0.8);
  bumpScene();
  let hits: SceneHit[];
  try {
    hits = await identifyScene(prepared.uri, s.traceKey);
  } finally {
    await deleteFile(prepared.uri);
  }
  const cands = await hitsToCandidates(hits);
  const latest = getState().pending.find((p) => p.id === shotId) || shot;
  const merged = mergeCandidates(latest.candidates, cands);
  await putPending({
    ...latest,
    candidates: merged,
    sceneTried: true,
    width: w,
    height: h,
    status: merged.length ? 'ready' : 'nothing',
  });
  await flushSaves();
  return { added: cands.length };
}

export type ShotResult = 'ready' | 'nothing' | 'error' | 'skipped';

export async function processShot(id: string): Promise<ShotResult> {
  const shot = await claimShot(id);
  if (!shot) return 'skipped';
  const settings = getState().settings;
  try {
    let lines = shot.lines;
    let width = shot.width;
    let height = shot.height;
    let ocrFailed = false;

    if (!lines.length) {
      try {
        const r = await recognize(shot.uri);
        lines = r.lines;
        width = r.width || width;
        height = r.height || height;
      } catch {
        ocrFailed = true;
      }
    }

    let calls = 0;
    let failures = 0;
    const search = async (q: string) => {
      calls++;
      try {
        return await searchAnime(q, { adult: settings.includeAdult });
      } catch (e) {
        failures++;
        throw e;
      }
    };

    let candidates: Candidate[] = [];
    if (lines.length) candidates = await analyzeLines(lines, width, height, search);

    if (!candidates.length && calls > 0 && failures === calls) {
      await putPending({
        ...shot,
        lines,
        width,
        height,
        ocrFailed,
        status: 'error',
        lockedAt: undefined,
        error: "Couldn't reach MyAnimeList. Check your connection and pull down to retry.",
      });
      return 'error';
    }

    let sceneTried = shot.sceneTried;
    if (!candidates.length && settings.autoScene && !sceneTried && sceneAllowed()) {
      try {
        if (!width || !height) {
          const sz = await imageSize(shot.uri);
          width = sz.width;
          height = sz.height;
        }
        const prepared = await resizeToJpeg(shot.uri, 640, 0.8);
        bumpScene();
        try {
          candidates = await hitsToCandidates(await identifyScene(prepared.uri, settings.traceKey));
        } finally {
          await deleteFile(prepared.uri);
        }
      } catch {
        // scene search is a bonus - ignore failures
      }
      sceneTried = true;
    }

    const status = candidates.length ? 'ready' : 'nothing';
    await putPending({
      ...shot,
      lines,
      width,
      height,
      candidates,
      sceneTried,
      ocrFailed,
      status,
      lockedAt: undefined,
      error: undefined,
    });
    return status;
  } catch (e: any) {
    await putPending({ ...shot, status: 'error', lockedAt: undefined, error: String((e && e.message) || e) });
    return 'error';
  }
}

let running = false;

// Processes everything that is waiting. Returns how many screenshots now have results.
export async function processQueue(): Promise<number> {
  if (running) return 0;
  running = true;
  let ready = 0;
  try {
    const now = Date.now();
    const ids = getState()
      .pending.filter((p) => p.status === 'queued' || (p.status === 'processing' && now - (p.lockedAt || 0) > 180000))
      .sort((a, b) => a.addedAt - b.addedAt)
      .map((p) => p.id);
    for (const id of ids) {
      const r = await processShot(id);
      if (r === 'ready') ready++;
    }
  } finally {
    running = false;
    await flushSaves();
  }
  return ready;
}

export function isProcessing(): boolean {
  return running;
}

// Puts failed screenshots back in the queue (used by pull-to-refresh).
export async function retryErrors(): Promise<void> {
  for (const p of getState().pending) {
    if (p.status === 'error') await putPending({ ...p, status: 'queued', error: undefined, lockedAt: undefined });
  }
}

export function ocrReady(): boolean {
  return ocrAvailable();
}

// ---------- saving ----------

async function makeThumb(uri: string): Promise<string> {
  const r = await resizeToJpeg(uri, 360, 0.6);
  const to = THUMBS + uid() + '.jpg';
  await moveFile(r.uri, to);
  return to;
}

// Removes the app's own copy of the screenshot and the queue item. The gallery original is not touched.
export async function finishShot(id: string): Promise<void> {
  const shot = getState().pending.find((p) => p.id === id);
  if (shot) await deleteFile(shot.uri);
  await removePending(id);
}

export async function approveShot(
  shotId: string,
  listId: string,
  chosen: Candidate[],
): Promise<{ added: number; skipped: number }> {
  const st = getState();
  const shot = st.pending.find((p) => p.id === shotId);
  const have = new Set(st.entries.filter((e) => e.listId === listId).map((e) => e.anime.malId));
  const unique: Candidate[] = [];
  for (const c of chosen) {
    if (have.has(c.malId)) continue;
    if (unique.some((u) => u.malId === c.malId)) continue;
    unique.push(c);
  }
  let thumb: string | null = null;
  if (unique.length && shot && st.settings.keepThumbnails) {
    try {
      thumb = await makeThumb(shot.uri);
    } catch {
      thumb = null;
    }
  }
  const now = Date.now();
  addEntries(
    unique.map((c) => ({
      id: uid(),
      listId,
      anime: c.anime,
      userRating: null,
      addedAt: now,
      exportedAt: null,
      thumb,
      source: c.source,
    })),
  );
  await finishShot(shotId);
  return { added: unique.length, skipped: chosen.length - unique.length };
}

// Deletes the thumbnail file only if no other entry still uses it.
export async function cleanupThumb(thumb: string | null) {
  if (!thumb) return;
  const stillUsed = getState().entries.some((e) => e.thumb === thumb);
  if (!stillUsed) await deleteFile(thumb);
}

// App state. One small store, saved to AsyncStorage.
// - lists / entries / watched / settings are saved as whole JSON values
// - each pending screenshot is saved under its own key, so the background task and the app
//   can both touch the queue without overwriting each other's lists
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { AnimeList, Entry, PendingShot, Settings, WatchedItem } from './types';
import { DEFAULT_EXPORT } from './services/exporter';
import { uid } from './services/ids';

export const DEFAULT_LIST_NAME = 'Anime Watch List';

export type State = {
  hydrated: boolean;
  lists: AnimeList[];
  entries: Entry[];
  watched: WatchedItem[];
  pending: PendingShot[];
  settings: Settings;
};

const K = {
  lists: 'ai:lists',
  entries: 'ai:entries',
  watched: 'ai:watched',
  settings: 'ai:settings',
  pendingIdx: 'ai:pending:index',
  pending: (id: string) => 'ai:pending:' + id,
};

function defaultSettings(defaultListId: string): Settings {
  return {
    theme: 'system',
    toastOnShare: true,
    notifyOnReady: false,
    backgroundProcessing: true,
    keepThumbnails: true,
    autoScene: true,
    includeAdult: false,
    traceKey: '',
    traceUsage: { month: '', count: 0 },
    defaultListId,
    export: { ...DEFAULT_EXPORT },
  };
}

let state: State = {
  hydrated: false,
  lists: [],
  entries: [],
  watched: [],
  pending: [],
  settings: defaultSettings(''),
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function getState(): State {
  return state;
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// Selectors must return values that already exist in the state (no new arrays/objects),
// then derive with useMemo in the component.
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable - keep running with the in-memory copy
  }
}

type Slice = 'lists' | 'entries' | 'watched' | 'settings';
const timers: Partial<Record<Slice, ReturnType<typeof setTimeout>>> = {};

function scheduleSave(slice: Slice) {
  const t = timers[slice];
  if (t) clearTimeout(t);
  timers[slice] = setTimeout(() => {
    timers[slice] = undefined;
    void writeJSON(K[slice], state[slice]);
  }, 250);
}

export async function flushSaves(): Promise<void> {
  for (const slice of ['lists', 'entries', 'watched', 'settings'] as Slice[]) {
    const t = timers[slice];
    if (t) {
      clearTimeout(t);
      timers[slice] = undefined;
      await writeJSON(K[slice], state[slice]);
    }
  }
}

function set(patch: Partial<State>, slices: Slice[]) {
  state = { ...state, ...patch };
  emit();
  slices.forEach(scheduleSave);
}

// ---------- loading ----------

async function loadPending(ids: string[]): Promise<PendingShot[]> {
  const out: PendingShot[] = [];
  for (const id of ids) {
    const p = await readJSON<PendingShot>(K.pending(id));
    if (p) out.push(p);
  }
  return out;
}

let hydratePromise: Promise<void> | null = null;

export function hydrate(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const [lists, entries, watched, saved, idx] = await Promise.all([
      readJSON<AnimeList[]>(K.lists),
      readJSON<Entry[]>(K.entries),
      readJSON<WatchedItem[]>(K.watched),
      readJSON<Partial<Settings>>(K.settings),
      readJSON<string[]>(K.pendingIdx),
    ]);

    let ls = lists || [];
    if (!ls.length) {
      ls = [{ id: uid(), name: DEFAULT_LIST_NAME, createdAt: Date.now() }];
      await writeJSON(K.lists, ls);
    }

    const base = defaultSettings(ls[0].id);
    const st: Settings = {
      ...base,
      ...(saved || {}),
      export: { ...DEFAULT_EXPORT, ...((saved && saved.export) || {}) },
      traceUsage: { ...base.traceUsage, ...((saved && saved.traceUsage) || {}) },
    };
    if (!st.defaultListId || !ls.some((l) => l.id === st.defaultListId)) st.defaultListId = ls[0].id;
    await writeJSON(K.settings, st);

    const pending = await loadPending(idx || []);
    state = { hydrated: true, lists: ls, entries: entries || [], watched: watched || [], pending, settings: st };
    emit();
  })();
  return hydratePromise;
}

// ---------- settings ----------

export function setSettings(patch: Partial<Settings>) {
  set({ settings: { ...state.settings, ...patch } }, ['settings']);
}

// ---------- lists ----------

export function addList(name: string): AnimeList {
  const l: AnimeList = { id: uid(), name: name.trim() || 'New list', createdAt: Date.now() };
  set({ lists: [...state.lists, l] }, ['lists']);
  return l;
}

export function renameList(id: string, name: string) {
  const n = name.trim();
  if (!n) return;
  set({ lists: state.lists.map((l) => (l.id === id ? { ...l, name: n } : l)) }, ['lists']);
}

// Removes a list. Its anime move to `moveTo` if given, otherwise they are deleted.
export function deleteList(id: string, moveTo?: string) {
  if (state.lists.length <= 1) return;
  const lists = state.lists.filter((l) => l.id !== id);
  let entries = state.entries;
  if (moveTo && lists.some((l) => l.id === moveTo)) {
    // anime that are already in the destination list are not copied twice
    const have = new Set(entries.filter((e) => e.listId === moveTo).map((e) => e.anime.malId));
    const rest: Entry[] = [];
    const moved: Entry[] = [];
    for (const e of entries) {
      if (e.listId !== id) {
        rest.push(e);
      } else if (!have.has(e.anime.malId)) {
        have.add(e.anime.malId);
        moved.push({ ...e, listId: moveTo });
      }
    }
    entries = [...rest, ...moved];
  } else {
    entries = entries.filter((e) => e.listId !== id);
  }
  const settings =
    state.settings.defaultListId === id ? { ...state.settings, defaultListId: lists[0].id } : state.settings;
  set({ lists, entries, settings }, ['lists', 'entries', 'settings']);
}

// ---------- entries ----------

export function addEntries(list: Entry[]) {
  if (!list.length) return;
  set({ entries: [...state.entries, ...list] }, ['entries']);
}

export function updateEntry(id: string, patch: Partial<Entry>) {
  set({ entries: state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, ['entries']);
}

export function deleteEntry(id: string) {
  set({ entries: state.entries.filter((e) => e.id !== id) }, ['entries']);
}

export function markExported(ids: string[]) {
  const s = new Set(ids);
  const now = Date.now();
  set({ entries: state.entries.map((e) => (s.has(e.id) ? { ...e, exportedAt: now } : e)) }, ['entries']);
}

// ---------- watched list ----------

export function setWatched(items: WatchedItem[]) {
  set({ watched: items }, ['watched']);
}

export function patchWatched(id: string, patch: Partial<WatchedItem>) {
  set({ watched: state.watched.map((w) => (w.id === id ? { ...w, ...patch } : w)) }, ['watched']);
}

// ---------- pending screenshots ----------

export async function reloadPending(): Promise<void> {
  const idx = (await readJSON<string[]>(K.pendingIdx)) || [];
  const list = await loadPending(idx);
  state = { ...state, pending: list };
  emit();
}

export async function putPending(shot: PendingShot): Promise<void> {
  await writeJSON(K.pending(shot.id), shot);
  const idx = (await readJSON<string[]>(K.pendingIdx)) || [];
  if (!idx.includes(shot.id)) {
    idx.push(shot.id);
    await writeJSON(K.pendingIdx, idx);
  }
  const others = state.pending.filter((p) => p.id !== shot.id);
  state = { ...state, pending: [...others, shot] };
  emit();
}

export async function removePending(id: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(K.pending(id));
  } catch {
    // ignore
  }
  const idx = ((await readJSON<string[]>(K.pendingIdx)) || []).filter((x) => x !== id);
  await writeJSON(K.pendingIdx, idx);
  state = { ...state, pending: state.pending.filter((p) => p.id !== id) };
  emit();
}

// Takes a queued screenshot for processing. Returns null if someone else already has it.
export async function claimShot(id: string): Promise<PendingShot | null> {
  const fresh = await readJSON<PendingShot>(K.pending(id));
  if (!fresh) return null;
  const stale = fresh.status === 'processing' && Date.now() - (fresh.lockedAt || 0) > 180000;
  if (fresh.status !== 'queued' && !stale) return null;
  const claimed: PendingShot = { ...fresh, status: 'processing', lockedAt: Date.now() };
  await putPending(claimed);
  return claimed;
}

// ---------- reset ----------

export async function resetAll(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('ai:')));
  } catch {
    // ignore
  }
  hydratePromise = null;
  state = {
    hydrated: false,
    lists: [],
    entries: [],
    watched: [],
    pending: [],
    settings: defaultSettings(''),
  };
  await hydrate();
}

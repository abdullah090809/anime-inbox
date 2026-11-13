// Shared types for Anime Inbox.

export type Anime = {
  malId: number;
  title: string; // MyAnimeList default title (usually romaji)
  titleEnglish: string | null;
  titleJapanese: string | null;
  synonyms: string[];
  score: number | null; // MAL score out of 10
  genres: string[];
  posterUrl: string | null;
  year: number | null;
  episodes: number | null;
};

// A line of text found in a screenshot, in image pixel coordinates.
export type OcrLine = { text: string; x: number; y: number; w: number; h: number };

export type CandidateSource = 'text' | 'scene' | 'search';

export type Candidate = {
  malId: number;
  anime: Anime;
  confidence: number; // 0..1
  source: CandidateSource;
  matchedText?: string;
  selected: boolean;
};

export type ShotStatus = 'queued' | 'processing' | 'ready' | 'nothing' | 'error';

export type PendingShot = {
  id: string;
  uri: string; // file:// uri of the app's own private copy
  addedAt: number;
  status: ShotStatus;
  lockedAt?: number;
  candidates: Candidate[];
  lines: OcrLine[];
  width: number;
  height: number;
  sceneTried: boolean;
  ocrFailed?: boolean;
  error?: string;
};

export type AnimeList = {
  id: string;
  name: string;
  createdAt: number;
};

export type Entry = {
  id: string;
  listId: string;
  anime: Anime;
  userRating: number | null; // 0..5
  addedAt: number;
  exportedAt: number | null;
  thumb: string | null; // small copy of the screenshot, if kept
  source: CandidateSource;
};

export type WatchedStatus = 'todo' | 'matched' | 'unmatched';

export type WatchedItem = {
  id: string;
  name: string; // name as written in the user's own list
  rating: number | null; // user's own rating out of 5
  status: WatchedStatus;
  malId: number | null;
  anime: Anime | null;
};

export type ExportOptions = {
  numbered: boolean;
  startAt: number;
  separator: string; // ' – ' | ' | ' | ', '
  english: boolean;
  japanese: boolean;
  rating: boolean;
  genres: boolean;
  year: boolean;
  episodes: boolean;
  link: boolean;
  maxGenres: number; // 0 = all
};

export type ThemeMode = 'system' | 'light' | 'dark';

export type Settings = {
  theme: ThemeMode;
  toastOnShare: boolean;
  notifyOnReady: boolean;
  backgroundProcessing: boolean;
  keepThumbnails: boolean;
  autoScene: boolean;
  includeAdult: boolean;
  traceKey: string;
  traceUsage: { month: string; count: number };
  defaultListId: string;
  export: ExportOptions;
};

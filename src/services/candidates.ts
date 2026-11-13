// Turns the raw text lines of a screenshot into a short, ranked list of possible anime titles.
// Pure functions - no React Native imports.
import type { OcrLine } from '../types';

export type RankedQuery = {
  text: string;
  prior: number; // 0..1, how likely this text is a title before looking it up
  reason: 'cue' | 'quote' | 'search-bar' | 'line' | 'block';
};

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

const NOISE: RegExp[] = [
  /^(reply|replies|hide|view|see more|see less|translate|translated|like|likes|share|send|comments?|pinned|top|newest|most relevant|following|follow|followers?|verified|author|creator|liked by creator|just now|edited|add comment.*|write a comment.*|add a comment.*|public|private|search)$/i,
  /^view (\d+ )?(more )?(repl(y|ies)|comments?)$/i,
  /^\d[\d.,]*\s?[kmb]?\s*(comments?|likes?|views?|replies|shares?)$/i,
  /^\d[\d.,]*\s?[kmb]?$/i,
  /^\d+\s?(s|m|h|d|w|mo|y|sec|min|hr|hour|day|week|month|year)s?( ago)?$/i,
  /^\d{1,2}:\d{2}(:\d{2})?( ?[ap]m)?$/i,
  /^[x×=l|\-_.\s]*$/i,
];

// Lines that ask for the name rather than give it.
const REQUEST = /\b(anime\s*name|name\s*(of|pls|please|plz)|pls|plz|please|source|sauce|what('s| is| anime)|which anime|anyone know|name\s*\?|title\s*\?)\b/i;

// Words that make a line sound like chat rather than a title.
const CHATTY = /\b(i|i'm|im|ive|i've|you|your|u|ur|waiting|thanks|thank|lol|lmao|omg|bro|bruh|love|loved|best|new season|season \d+ out|please|hello|hi)\b/i;

const SMALL_WORDS = new Set(['of', 'the', 'a', 'an', 'in', 'to', 'no', 'wa', 'ga', 'and', 'on', 'at', 'for', 'with', 'is', 'as', 'or', 'by', 'de', 'wo', 'ni']);

const CUES: RegExp[] = [
  /(?:it'?s called|its called|it is called|is called|the name is|name is|title is|anime is|anime name is|anime|title|name)\s*[:\-–]\s*["“']?(.{3,})$/i,
  /(?:it'?s called|its called|it is called|is called|the name is|name is|title is|anime is)\s+["“']?(.{3,})$/i,
];

export function cleanText(t: string): string {
  let s = t || '';
  s = s.replace(EMOJI_RE, ' ');
  s = s.replace(/https?:\/\/\S+/gi, ' ');
  s = s.replace(/@[\w.]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\s\-–—_|:;,.·•~*"“”]+/, '').replace(/[\s\-–—_|:;,·•~*"“”]+$/, '');
  return s.trim();
}

function letters(s: string): number {
  return (s.match(/\p{L}/gu) || []).length;
}

export function isNoise(t: string): boolean {
  if (!t) return true;
  if (letters(t) < 3) return true;
  if (t.length > 0 && letters(t) / t.length < 0.5) return true;
  return NOISE.some((re) => re.test(t));
}

function words(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

function titleCaseRatio(s: string): number {
  const ws = words(s).filter((w) => /\p{L}/u.test(w) && !SMALL_WORDS.has(w.toLowerCase()));
  if (!ws.length) return 0;
  const caps = ws.filter((w) => /^[\p{Lu}\d]/u.test(w)).length;
  return caps / ws.length;
}

function linePrior(s: string): number {
  const n = words(s).length;
  let p: number;
  if (n === 1) p = s.length >= 5 ? 0.3 : 0;
  else if (n <= 7) p = 0.6;
  else if (n <= 10) p = 0.25;
  else p = 0;
  if (p === 0) return 0;
  if (titleCaseRatio(s) >= 0.6 && n >= 2) p += 0.2;
  if (/[?!]/.test(s)) p -= 0.25;
  if (/\.$/.test(s)) p -= 0.1;
  if (CHATTY.test(s)) p -= 0.3;
  return Math.max(0, Math.min(1, p));
}

function stripSearchTail(s: string): string {
  return s
    .replace(/[…._\s]+$/g, '')
    .replace(/\s+on$/i, '')
    .trim();
}

type Kept = { line: OcrLine; text: string };

export function rankQueries(lines: OcrLine[], imgW: number, imgH: number): RankedQuery[] {
  const out = new Map<string, RankedQuery>();
  const add = (text: string, prior: number, reason: RankedQuery['reason']) => {
    const t = cleanText(text);
    if (t.length < 3 || prior <= 0 || isNoise(t)) return;
    const key = t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!key) return;
    const old = out.get(key);
    if (!old || old.prior < prior) out.set(key, { text: t, prior: Math.min(1, prior), reason });
  };

  const sorted = [...lines].sort((a, b) => a.y - b.y || a.x - b.x);
  const kept: Kept[] = [];
  for (const line of sorted) {
    // skip the phone's status bar and the bottom navigation / comment box area
    if (imgH > 0 && (line.y < imgH * 0.045 || line.y + line.h > imgH * 0.965)) continue;
    const raw = (line.text || '').trim();

    // TikTok's "Search: ..." suggestion usually echoes the video's topic
    const sm = raw.match(/^search\s*:?\s*(.+)$/i);
    if (sm) {
      add(stripSearchTail(sm[1]), 0.55, 'search-bar');
      continue;
    }

    const text = cleanText(raw);
    if (isNoise(text)) continue;

    // "it's called X" style answers
    let cued = false;
    for (const re of CUES) {
      const m = text.match(re);
      if (m && m[1]) {
        add(m[1], 0.9, 'cue');
        cued = true;
        break;
      }
    }
    if (cued) continue;

    // quoted title
    const q = text.match(/^["“']([^"”']{3,})["”']?$/);
    if (q) {
      add(q[1], 0.85, 'quote');
      continue;
    }

    if (REQUEST.test(text)) continue;
    kept.push({ line, text });
  }

  for (const k of kept) add(k.text, linePrior(k.text), 'line');

  // titles often wrap over two or three lines in a comment
  const leftTol = imgW * 0.08;
  for (let i = 0; i < kept.length; i++) {
    let joined = kept[i].text;
    let top = kept[i];
    for (let span = 2; span <= 3 && i + span - 1 < kept.length; span++) {
      const next = kept[i + span - 1];
      const gap = next.line.y - (top.line.y + top.line.h);
      const aligned = Math.abs(next.line.x - kept[i].line.x) <= leftTol;
      if (!aligned || gap > top.line.h * 0.9 || gap < -top.line.h * 0.5) break;
      joined = joined + ' ' + next.text;
      top = next;
      const n = words(joined).length;
      if (n > 10) break;
      const parts = kept.slice(i, i + span);
      // average, so a weak line (a username, say) cannot make a block outrank the real title line
      const avg = parts.reduce((sum, p) => sum + linePrior(p.text), 0) / parts.length;
      add(joined, Math.min(1, avg + 0.1), 'block');
    }
  }

  return [...out.values()].sort((a, b) => b.prior - a.prior || b.text.length - a.text.length);
}

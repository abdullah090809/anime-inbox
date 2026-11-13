// Reads the user's own "watched list" text file:  "1. Attack on titans (4.9/5)"
// Pure functions - no React Native imports.

export type ParsedWatched = { name: string; rating: number | null };

const START = /^\s*\d+\s*[.)]\s*(.*)$/;
const RATED_END = /^(.*?)\s*\(\s*(\d+(?:\.\d+)?)\s*\/\s*5\s*\)\s*$/;

export function parseWatchedText(text: string): ParsedWatched[] {
  const lines = (text || '').replace(/^﻿/, '').replace(/\r/g, '').split('\n');
  const out: ParsedWatched[] = [];
  let buf: string | null = null;

  const finish = (rating: number | null) => {
    if (buf === null) return;
    const name = buf.replace(/\s+/g, ' ').trim();
    if (name) out.push({ name, rating });
    buf = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const start = line.match(START);
    if (start) {
      // a new numbered entry; close the previous one if it never got a rating
      finish(null);
      buf = start[1];
    } else if (buf !== null) {
      buf += ' ' + line; // names can wrap onto a second line
    } else {
      buf = line; // a line without a number
    }
    const current: string = buf === null ? '' : (buf as string);
    const rated: RegExpMatchArray | null = current.match(RATED_END);
    if (rated) {
      buf = rated[1];
      const r: number = parseFloat(rated[2]);
      finish(isNaN(r) ? null : Math.min(5, r));
    }
  }
  finish(null);
  return out;
}

export function normKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

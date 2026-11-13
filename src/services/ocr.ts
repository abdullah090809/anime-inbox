// Reads the text in a screenshot on the phone itself (Google ML Kit, no internet needed).
// The native module is loaded defensively: if it is missing from the build the app still starts,
// and screenshots simply go to the manual "pick text" flow.
import { Image } from 'react-native';
import '../env';
import type { OcrLine } from '../types';

let mod: any = null;
try {
  mod = require('@infinitered/react-native-mlkit-text-recognition');
} catch {
  mod = null;
}

export function ocrAvailable(): boolean {
  return !!(mod && typeof mod.recognizeText === 'function');
}

export function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err),
    );
  });
}

function toRect(f: any): { x: number; y: number; w: number; h: number } | null {
  if (!f) return null;
  const left = typeof f.left === 'number' ? f.left : typeof f.x === 'number' ? f.x : null;
  const top = typeof f.top === 'number' ? f.top : typeof f.y === 'number' ? f.y : null;
  if (left === null || top === null) return null;
  const w = typeof f.width === 'number' ? f.width : typeof f.right === 'number' ? f.right - left : null;
  const h = typeof f.height === 'number' ? f.height : typeof f.bottom === 'number' ? f.bottom - top : null;
  if (w === null || h === null) return null;
  return { x: left, y: top, w: Math.max(1, w), h: Math.max(1, h) };
}

export async function recognize(uri: string): Promise<{ lines: OcrLine[]; width: number; height: number }> {
  if (!ocrAvailable()) throw new Error('Text reading is not available in this build');
  const size = await imageSize(uri).catch(() => ({ width: 0, height: 0 }));
  let res: any;
  try {
    res = await mod.recognizeText(uri);
  } catch {
    res = await mod.recognizeText(uri.replace(/^file:\/\//, ''));
  }
  const lines: OcrLine[] = [];
  for (const block of (res && res.blocks) || []) {
    for (const line of block.lines || []) {
      const r = toRect(line.frame) || toRect(block.frame);
      const text = String(line.text || '').trim();
      if (r && text) lines.push({ text, ...r });
    }
  }
  return { lines, width: size.width, height: size.height };
}

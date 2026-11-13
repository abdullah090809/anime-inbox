// File helpers. Expo SDK 54 moved the classic file API to 'expo-file-system/legacy'.

let FS: any;
try {
  FS = require('expo-file-system/legacy');
} catch {
  FS = require('expo-file-system');
}

export const DOC: string = FS.documentDirectory || '';
export const CACHE: string = FS.cacheDirectory || '';
// The Android share target (plugins/withQuickShare.js) drops copies into files/inbox
export const INBOX = DOC + 'inbox/';
export const SHOTS = DOC + 'shots/';
export const THUMBS = DOC + 'thumbs/';
const TOAST_OFF = DOC + 'toast_off';

export async function ensureDirs(): Promise<void> {
  for (const d of [INBOX, SHOTS, THUMBS]) {
    try {
      const info = await FS.getInfoAsync(d);
      if (!info.exists) await FS.makeDirectoryAsync(d, { intermediates: true });
    } catch {
      // ignore - the next call will report the real problem
    }
  }
}

export async function listDir(dir: string): Promise<string[]> {
  try {
    return await FS.readDirectoryAsync(dir);
  } catch {
    return [];
  }
}

export async function info(uri: string): Promise<{ exists: boolean; modificationTime?: number; size?: number }> {
  try {
    return await FS.getInfoAsync(uri);
  } catch {
    return { exists: false };
  }
}

export async function moveFile(from: string, to: string): Promise<void> {
  await FS.moveAsync({ from, to });
}

export async function copyFile(from: string, to: string): Promise<void> {
  await FS.copyAsync({ from, to });
}

export async function deleteFile(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  try {
    await FS.deleteAsync(uri, { idempotent: true });
  } catch {
    // already gone
  }
}

export async function readText(uri: string): Promise<string> {
  return FS.readAsStringAsync(uri);
}

export async function writeText(uri: string, text: string): Promise<void> {
  await FS.writeAsStringAsync(uri, text);
}

// The share target checks for this marker file to decide whether to show its "Saved" message.
export async function applyToastSetting(show: boolean): Promise<void> {
  try {
    if (show) await deleteFile(TOAST_OFF);
    else await writeText(TOAST_OFF, '1');
  } catch {
    // not critical
  }
}

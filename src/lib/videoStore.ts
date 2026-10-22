// The background video lives in IndexedDB: localStorage is far too small for
// it, and a data URL in settings would bloat every save and backup. One video
// at a time, under MAX_VIDEO_BYTES.

export const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20 MB
export const VIDEO_TYPES = ['video/mp4', 'video/webm'];

const DB = 'devdeck-media';
const STORE = 'media';
const KEY = 'background-video';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

// Why a file can't be used, or null when it can.
export function videoProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!VIDEO_TYPES.includes(file.type)) return 'Use an MP4 or WebM video.';
  if (file.size > MAX_VIDEO_BYTES) return `That video is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`;
  return null;
}

export const saveBackgroundVideo = (file: Blob) => run('readwrite', (s) => s.put(file, KEY));
export const loadBackgroundVideo = () => run<Blob | undefined>('readonly', (s) => s.get(KEY));
export const deleteBackgroundVideo = () => run('readwrite', (s) => s.delete(KEY));

import {
  DEFAULT_RECORDING_SETTINGS,
  RecordedVideoItem,
  RecordingSettings,
} from '../types/recorder';
import { normalizeRegion } from './regionSelection';

const SETTINGS_STORAGE_KEY = 'framecut_recording_settings_v1';
const DB_NAME = 'framecut_recordings_db';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

interface StoredRecordingRecord {
  id: number;
  displayName: string;
  width: number;
  height: number;
  durationMs: number;
  sizeBytes: number;
  dateAddedSec: number;
  mimeType: string;
  blob: Blob;
}

export function loadStoredSettings(): RecordingSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RECORDING_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<RecordingSettings>;
    return {
      ...DEFAULT_RECORDING_SETTINGS,
      ...parsed,
      selectedRegion: normalizeRegion(
        parsed.selectedRegion ?? DEFAULT_RECORDING_SETTINGS.selectedRegion,
      ),
    };
  } catch {
    return { ...DEFAULT_RECORDING_SETTINGS };
  }
}

export function saveStoredSettings(settings: RecordingSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllRecordings(): Promise<RecordedVideoItem[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result as StoredRecordingRecord[]) ?? [];
        const items: RecordedVideoItem[] = rows
          .map(({ blob: _blob, ...meta }) => meta)
          .sort((a, b) => b.dateAddedSec - a.dateAddedSec || b.id - a.id);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveRecordingToDb(
  meta: Omit<RecordedVideoItem, 'id'>,
  blob: Blob,
): Promise<RecordedVideoItem> {
  const id = Date.now();
  const record: StoredRecordingRecord = {
    id,
    ...meta,
    blob,
  };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  const { blob: _b, ...saved } = record;
  return saved;
}

export async function getRecordingBlob(id: number): Promise<Blob | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const rec = req.result as StoredRecordingRecord | undefined;
        resolve(rec?.blob ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteRecordingFromDb(id: number): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return true;
  } catch {
    return false;
  }
}

// src/services/profilePictureStorage.ts
//
// ── Profile picture storage — IndexedDB ───────────────────────────────────────
//
// Stores the user's profile picture as a binary ArrayBuffer in IndexedDB.
// The UI never touches IndexedDB directly — it calls this module only.
//
// MIGRATION PATH:
// When ready to move back to Firebase Storage, implement the same three
// exported functions in a new file (e.g. firebaseProfilePictureStorage.ts)
// and swap the import in db.ts. Zero changes needed in Settings.tsx or
// useStore.ts.
//
// DATABASE LAYOUT:
//   DB name : 'studibyte-profile'
//   Version : 1
//   Store   : 'avatar' — single record keyed by 'current'
//
// LIMITS:
//   Max file size : 5 MB (profile pictures don't need to be large)
//   Allowed types : JPEG, PNG, GIF, WebP

const DB_NAME    = 'studibyte-profile';
const DB_VERSION = 1;
const STORE_NAME = 'avatar';
const RECORD_KEY = 'current'; // single record — one avatar per user session

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_AVATAR_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// ── Stored record shape ───────────────────────────────────────────────────────
interface AvatarRecord {
  id:        'current';
  data:      ArrayBuffer;
  mimeType:  string;
  savedAt:   string; // ISO timestamp
  sizeBytes: number;
}

// ── DB open ───────────────────────────────────────────────────────────────────
let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = e => {
      _db = (e.target as IDBOpenDBRequest).result;
      _db.onclose = () => { _db = null; };
      resolve(_db);
    };

    req.onerror   = () => reject(
      new Error(`[ProfilePictureStorage] Failed to open IndexedDB: ${req.error?.message}`)
    );
    req.onblocked = () => reject(
      new Error('[ProfilePictureStorage] IndexedDB blocked — close other tabs and retry.')
    );
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dataUrlToBuffer(dataUrl: string): { buffer: ArrayBuffer; mimeType: string } {
  const [header, b64] = dataUrl.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary   = atob(b64);
  const buffer   = new ArrayBuffer(binary.length);
  const view     = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return { buffer, mimeType };
}

function bufferToBlobUrl(buffer: ArrayBuffer, mimeType: string): string {
  const blob = new Blob([buffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save a profile picture to IndexedDB.
 *
 * @param dataUrl  Base64 data URL from FileReader (e.g. "data:image/jpeg;base64,...")
 * @returns        A fresh blob: URL for immediate display in the UI
 *
 * @throws If the MIME type is not an allowed image type
 * @throws If the file exceeds MAX_AVATAR_BYTES
 * @throws If IndexedDB write fails
 */
export async function saveProfilePicture(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) {
    throw new Error('[ProfilePictureStorage] Input must be a base64 data URL.');
  }

  const { buffer, mimeType } = dataUrlToBuffer(dataUrl);

  // MIME type validation
  if (!ALLOWED_AVATAR_MIMES.has(mimeType)) {
    throw new Error(
      `[ProfilePictureStorage] File type "${mimeType}" is not allowed. ` +
      'Use JPEG, PNG, GIF, or WebP.'
    );
  }

  // Size validation
  if (buffer.byteLength > MAX_AVATAR_BYTES) {
    throw new Error(
      `[ProfilePictureStorage] Image is too large ` +
      `(${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). ` +
      `Maximum allowed size is ${MAX_AVATAR_BYTES / 1024 / 1024} MB.`
    );
  }

  const db = await openDB();

  const record: AvatarRecord = {
    id:        RECORD_KEY,
    data:      buffer,
    mimeType,
    savedAt:   new Date().toISOString(),
    sizeBytes: buffer.byteLength,
  };

  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => {
      console.error('[ProfilePictureStorage] IDB write failed:', tx.error);
      reject(new Error(`[ProfilePictureStorage] Failed to save: ${tx.error?.message}`));
    };
    req.onerror = () => {
      console.error('[ProfilePictureStorage] IDB put failed:', req.error);
    };
  });

  console.info(
    `[ProfilePictureStorage] Saved avatar — ` +
    `${(buffer.byteLength / 1024).toFixed(1)} KB, type: ${mimeType}`
  );

  // Return a fresh blob: URL for immediate use
  return bufferToBlobUrl(buffer, mimeType);
}

/**
 * Load the stored profile picture from IndexedDB.
 *
 * @returns  A fresh blob: URL if a picture is stored, or null if none.
 *
 * blob: URLs are session-scoped — this must be called on every app load
 * to reconstruct a usable URL from the stored binary data.
 */
export async function loadProfilePicture(): Promise<string | null> {
  try {
    const db = await openDB();

    const record = await new Promise<AvatarRecord | undefined>((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      req.onsuccess = () => resolve(req.result as AvatarRecord | undefined);
      req.onerror   = () => {
        console.error('[ProfilePictureStorage] IDB read failed:', req.error);
        reject(new Error(`[ProfilePictureStorage] Failed to load: ${req.error?.message}`));
      };
    });

    if (!record) {
      console.info('[ProfilePictureStorage] No avatar found in IndexedDB.');
      return null;
    }

    console.info(
      `[ProfilePictureStorage] Loaded avatar — ` +
      `${(record.sizeBytes / 1024).toFixed(1)} KB, saved: ${record.savedAt}`
    );

    return bufferToBlobUrl(record.data, record.mimeType);

  } catch (err) {
    // Non-fatal — log and return null so the app loads without a picture
    console.error('[ProfilePictureStorage] Failed to load avatar:', err);
    return null;
  }
}

/**
 * Delete the stored profile picture from IndexedDB.
 * Safe to call even if no picture is stored.
 */
export async function deleteProfilePicture(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = () => {
        console.info('[ProfilePictureStorage] Avatar deleted from IndexedDB.');
        resolve();
      };
      tx.onerror = () => {
        console.error('[ProfilePictureStorage] Delete failed:', tx.error);
        reject(new Error(`[ProfilePictureStorage] Failed to delete: ${tx.error?.message}`));
      };
    });
  } catch (err) {
    // Non-fatal — log only
    console.error('[ProfilePictureStorage] deleteProfilePicture error:', err);
  }
}

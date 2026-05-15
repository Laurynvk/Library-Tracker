import JSZip from 'jszip';

const IDB_NAME = 'library-tracker';
const IDB_STORE = 'handles';
const ROOT_DIR_KEY = 'rootDir';
const TRACK_DIR_KEY_PREFIX = 'trackDir:';

function trackDirKey(trackId: string): string {
  return `${TRACK_DIR_KEY_PREFIX}${trackId}`;
}

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Persists a FileSystemDirectoryHandle in IndexedDB under the key "rootDir".
 * Browsers that support the File System Access API allow structured-cloning
 * the handle directly into IDB.
 */
export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDB();
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    await idbRequest(tx.objectStore(IDB_STORE).put(handle, ROOT_DIR_KEY));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Removes any previously saved root directory handle from IndexedDB.
 * Safe to call when no handle is stored.
 */
export async function clearDirectoryHandle(): Promise<void> {
  const db = await openHandleDB();
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    await idbRequest(tx.objectStore(IDB_STORE).delete(ROOT_DIR_KEY));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Loads the previously saved root directory handle, or returns null if none exists.
 */
export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDB();
  try {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const result = await idbRequest(tx.objectStore(IDB_STORE).get(ROOT_DIR_KEY));
    return (result as FileSystemDirectoryHandle | undefined) ?? null;
  } finally {
    db.close();
  }
}

/**
 * Persists a per-track FileSystemDirectoryHandle override. When present, this
 * overrides the album/Tracks/title walk used by revealTrackFolder for this
 * specific track. Stored client-side only (per-device).
 */
export async function saveTrackFolderHandle(
  trackId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openHandleDB();
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    await idbRequest(tx.objectStore(IDB_STORE).put(handle, trackDirKey(trackId)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Loads the per-track directory handle override, or returns null if none exists.
 */
export async function loadTrackFolderHandle(
  trackId: string,
): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDB();
  try {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const result = await idbRequest(tx.objectStore(IDB_STORE).get(trackDirKey(trackId)));
    return (result as FileSystemDirectoryHandle | undefined) ?? null;
  } finally {
    db.close();
  }
}

/**
 * Removes any previously saved per-track handle. Safe to call when none stored.
 */
export async function clearTrackFolderHandle(trackId: string): Promise<void> {
  const db = await openHandleDB();
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    await idbRequest(tx.objectStore(IDB_STORE).delete(trackDirKey(trackId)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

type PermissionDescriptor = { mode: 'read' | 'readwrite' };
type PermissionState = 'granted' | 'denied' | 'prompt';
interface HandleWithPermissions {
  queryPermission?: (desc: PermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (desc: PermissionDescriptor) => Promise<PermissionState>;
}

/**
 * Ensures we have readwrite permission on the given directory handle.
 * Queries current permission; if not granted, prompts the user.
 * Returns true if permission is (or becomes) granted, false otherwise.
 */
export async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const h = handle as unknown as HandleWithPermissions;
  const opts: PermissionDescriptor = { mode: 'readwrite' };
  if (typeof h.queryPermission === 'function') {
    const current = await h.queryPermission(opts);
    if (current === 'granted') return true;
  }
  if (typeof h.requestPermission === 'function') {
    const requested = await h.requestPermission(opts);
    return requested === 'granted';
  }
  return false;
}

export interface FolderSpec {
  albumName: string;
  topLevelFolders: string[];   // e.g. ['_DEMO2MX', 'Tracks', 'Print']
  trackTitle: string | null;   // if set, creates Tracks/{trackTitle} subfolder
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Uses the File System Access API to create folders directly on disk.
 * Prompts user to pick a parent directory, then creates albumName/ inside it.
 * Returns the album folder name on success, null if user cancelled the picker.
 */
// Indirection layer so tests can swap out persistence and permission helpers
// without going through fake-indexeddb's structuredClone (which drops the
// permission methods that a real FileSystemDirectoryHandle would retain).
export const _folderCreationInternals = {
  loadDirectoryHandle,
  verifyPermission,
  saveDirectoryHandle,
};

export async function createFoldersOnDesktop(spec: FolderSpec): Promise<string | null> {
  try {
    let dirHandle: FileSystemDirectoryHandle | null = null;

    // Try the previously saved handle first; if usable, skip the picker entirely.
    const saved = await _folderCreationInternals.loadDirectoryHandle().catch(() => null);
    if (saved) {
      const ok = await _folderCreationInternals.verifyPermission(saved).catch(() => false);
      if (ok) {
        dirHandle = saved;
      }
    }

    if (!dirHandle) {
      dirHandle = await (window as unknown as { showDirectoryPicker: (opts: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' });
      // Persist for next time. Don't fail folder creation if save fails.
      await _folderCreationInternals.saveDirectoryHandle(dirHandle).catch(() => undefined);
    }

    const albumDir = await dirHandle.getDirectoryHandle(spec.albumName, { create: true });

    for (const name of spec.topLevelFolders) {
      const subDir = await albumDir.getDirectoryHandle(name, { create: true });
      if (name === 'Tracks' && spec.trackTitle) {
        await subDir.getDirectoryHandle(spec.trackTitle, { create: true });
      }
    }

    return spec.albumName;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return null;
    throw e;
  }
}

/**
 * Creates a single named subfolder beneath the given parent directory handle.
 * Used when a track gains a title after its enclosing folders were already
 * created — we add `parent/title/` without disturbing siblings.
 */
export async function createTitleFolderUnder(
  parentHandle: FileSystemDirectoryHandle,
  title: string,
): Promise<void> {
  await parentHandle.getDirectoryHandle(title, { create: true });
}

/**
 * Walks down from the saved root handle into `<album>/Tracks` if present.
 * Returns the deepest existing handle (the "track folder") plus the path
 * segments traversed, so callers can render a human-readable suggested path.
 * Returns null if File System Access isn't available or no root handle is saved.
 */
export async function resolveTrackParentHandle(
  albumFolder: string | null,
): Promise<{ parent: FileSystemDirectoryHandle; segments: string[] } | null> {
  if (!isFileSystemAccessSupported()) return null;
  const root = await _folderCreationInternals.loadDirectoryHandle().catch(() => null);
  if (!root) return null;
  const ok = await _folderCreationInternals.verifyPermission(root).catch(() => false);
  if (!ok) return null;

  const segments: string[] = [root.name];
  let cursor: FileSystemDirectoryHandle = root;

  if (albumFolder) {
    try {
      const albumDir = await cursor.getDirectoryHandle(albumFolder, { create: false });
      cursor = albumDir;
      segments.push(albumFolder);
      try {
        const tracksDir = await cursor.getDirectoryHandle('Tracks', { create: false });
        cursor = tracksDir;
        segments.push('Tracks');
      } catch {
        // No Tracks subfolder yet — title folder will land directly under the album.
      }
    } catch {
      // Album folder doesn't exist — fall back to creating under the root.
    }
  }

  return { parent: cursor, segments };
}

/**
 * Walks the saved root handle down to `<album>/Tracks/<title>` and asks the
 * browser to surface the OS file picker rooted at that folder. The browser
 * sandbox forbids actually opening Finder/Explorer from JS — this is the
 * closest the web platform allows: the user sees the system directory dialog
 * scoped to the requested folder.
 *
 * Throws if the File System Access API is unavailable, no root handle is
 * saved/permitted, or any of the path segments is missing. The caller is
 * expected to catch these and surface an honest inline message.
 */
export async function revealTrackFolder(
  albumName: string,
  title: string,
  trackId?: string,
): Promise<void> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API not supported in this browser.');
  }

  let cursor: FileSystemDirectoryHandle | null = null;

  // Prefer a per-track override if one is saved and still permitted.
  if (trackId) {
    const override = await loadTrackFolderHandle(trackId).catch(() => null);
    if (override) {
      const okOverride = await _folderCreationInternals
        .verifyPermission(override)
        .catch(() => false);
      if (okOverride) {
        cursor = override;
      }
    }
  }

  if (!cursor) {
    const root = await _folderCreationInternals.loadDirectoryHandle().catch(() => null);
    if (!root) {
      throw new Error('No saved root folder. Pick a folder first via the brief modal.');
    }
    const ok = await _folderCreationInternals.verifyPermission(root).catch(() => false);
    if (!ok) {
      throw new Error('Permission denied for the saved root folder.');
    }

    try {
      const albumDir = await root.getDirectoryHandle(albumName, { create: false });
      const tracksDir = await albumDir.getDirectoryHandle('Tracks', { create: false });
      cursor = await tracksDir.getDirectoryHandle(title, { create: false });
    } catch {
      throw new Error(`Folder not found on disk: ${albumName}/Tracks/${title}`);
    }
  }

  const picker = (window as unknown as {
    showDirectoryPicker?: (opts: object) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
  if (typeof picker !== 'function') {
    throw new Error('File System Access API not supported in this browser.');
  }
  try {
    await picker({ startIn: cursor, mode: 'readwrite' });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return;
    throw e;
  }
}

/**
 * Generates a zip file containing the empty folder structure and triggers a download.
 * JSZip requires a placeholder file inside each folder to preserve empty directories.
 */
export async function createFoldersAsZip(spec: FolderSpec): Promise<void> {
  const zip = new JSZip();
  const album = zip.folder(spec.albumName)!;

  for (const name of spec.topLevelFolders) {
    const sub = album.folder(name)!;
    if (name === 'Tracks' && spec.trackTitle) {
      sub.folder(spec.trackTitle)!.file('.gitkeep', '');
    } else {
      sub.file('.gitkeep', '');
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${spec.albumName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

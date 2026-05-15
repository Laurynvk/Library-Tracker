import JSZip from 'jszip';

const IDB_NAME = 'library-tracker';
const IDB_STORE = 'handles';
const ROOT_DIR_KEY = 'rootDir';

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

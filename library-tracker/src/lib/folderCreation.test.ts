import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import { saveDirectoryHandle, loadDirectoryHandle, verifyPermission, createFoldersOnDesktop, _folderCreationInternals, type FolderSpec } from './folderCreation';

// Builds a fake FileSystemDirectoryHandle that records all directories created
// beneath it via getDirectoryHandle. Used to assert folder structure was
// created without touching a real filesystem.
function makeRecordingDir(name: string, log: string[] = []) {
  const dir = {
    kind: 'directory' as const,
    name,
    async getDirectoryHandle(child: string) {
      const childPath = `${name}/${child}`;
      log.push(childPath);
      return makeRecordingDir(childPath, log).dir;
    },
  };
  return { dir: dir as unknown as FileSystemDirectoryHandle, log };
}

// Minimal stand-in for FileSystemDirectoryHandle that survives structured clone
// (fake-indexeddb uses real structuredClone under the hood).
function makeHandle(name: string): FileSystemDirectoryHandle {
  return { kind: 'directory', name } as unknown as FileSystemDirectoryHandle;
}

describe('directory handle persistence', () => {
  beforeEach(() => {
    // Reset the in-memory IDB between tests so state doesn't bleed across cases.
    globalThis.indexedDB = new IDBFactory();
  });

  it('saves a handle and loads it back', async () => {
    const handle = makeHandle('Music');
    await saveDirectoryHandle(handle);
    const loaded = await loadDirectoryHandle();
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Music');
    expect(loaded?.kind).toBe('directory');
  });

  it('returns null when nothing has been stored', async () => {
    const loaded = await loadDirectoryHandle();
    expect(loaded).toBeNull();
  });

  it('overwrites the previously stored handle', async () => {
    await saveDirectoryHandle(makeHandle('First'));
    await saveDirectoryHandle(makeHandle('Second'));
    const loaded = await loadDirectoryHandle();
    expect(loaded?.name).toBe('Second');
  });
});

describe('verifyPermission', () => {
  it('returns true immediately when permission is already granted', async () => {
    const queryPermission = vi.fn().mockResolvedValue('granted');
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const handle = { kind: 'directory', name: 'X', queryPermission, requestPermission } as unknown as FileSystemDirectoryHandle;

    const result = await verifyPermission(handle);
    expect(result).toBe(true);
    expect(queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('requests permission when current state is "prompt" and returns true if granted', async () => {
    const queryPermission = vi.fn().mockResolvedValue('prompt');
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const handle = { kind: 'directory', name: 'X', queryPermission, requestPermission } as unknown as FileSystemDirectoryHandle;

    const result = await verifyPermission(handle);
    expect(result).toBe(true);
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
  });

  it('returns false when the user denies the permission prompt', async () => {
    const queryPermission = vi.fn().mockResolvedValue('prompt');
    const requestPermission = vi.fn().mockResolvedValue('denied');
    const handle = { kind: 'directory', name: 'X', queryPermission, requestPermission } as unknown as FileSystemDirectoryHandle;

    const result = await verifyPermission(handle);
    expect(result).toBe(false);
  });

  it('returns false when the handle exposes no permission APIs', async () => {
    const handle = { kind: 'directory', name: 'X' } as unknown as FileSystemDirectoryHandle;
    const result = await verifyPermission(handle);
    expect(result).toBe(false);
  });
});

describe('createFoldersOnDesktop', () => {
  const spec: FolderSpec = {
    albumName: 'MyAlbum',
    topLevelFolders: ['Tracks', 'Print'],
    trackTitle: 'Track1',
  };

  // Snapshot real internals so we can restore them after each test.
  const realInternals = { ..._folderCreationInternals };

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    // Vitest runs in node by default — install a fresh window stub per test.
    delete (globalThis as unknown as { window?: unknown }).window;
    Object.assign(_folderCreationInternals, realInternals);
  });

  it('uses saved handle and skips showDirectoryPicker when permission is granted', async () => {
    const log: string[] = [];
    const { dir } = makeRecordingDir('root', log);
    const queryPermission = vi.fn().mockResolvedValue('granted');
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const savedHandle = Object.assign(dir, { queryPermission, requestPermission });

    _folderCreationInternals.loadDirectoryHandle = async () => savedHandle;
    const saveSpy = vi.fn(realInternals.saveDirectoryHandle);
    _folderCreationInternals.saveDirectoryHandle = saveSpy;

    const picker = vi.fn();
    (globalThis as unknown as { window: { showDirectoryPicker: typeof picker } }).window = { showDirectoryPicker: picker };

    const result = await createFoldersOnDesktop(spec);
    expect(result).toBe('MyAlbum');
    expect(picker).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
    expect(queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(log).toContain('root/MyAlbum');
    expect(log).toContain('root/MyAlbum/Tracks');
    expect(log).toContain('root/MyAlbum/Tracks/Track1');
    expect(log).toContain('root/MyAlbum/Print');
  });

  it('calls showDirectoryPicker and saves the new handle when no saved handle exists', async () => {
    const log: string[] = [];
    const { dir } = makeRecordingDir('picked', log);

    const saveSpy = vi.fn(async () => undefined);
    _folderCreationInternals.saveDirectoryHandle = saveSpy;

    const picker = vi.fn().mockResolvedValue(dir);
    (globalThis as unknown as { window: { showDirectoryPicker: typeof picker } }).window = { showDirectoryPicker: picker };

    const result = await createFoldersOnDesktop(spec);
    expect(result).toBe('MyAlbum');
    expect(picker).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0]?.[0]).toBe(dir);
  });

  it('falls back to showDirectoryPicker when saved handle permission is denied', async () => {
    const savedLog: string[] = [];
    const { dir: savedDir } = makeRecordingDir('saved', savedLog);
    const queryPermission = vi.fn().mockResolvedValue('prompt');
    const requestPermission = vi.fn().mockResolvedValue('denied');
    const savedHandle = Object.assign(savedDir, { queryPermission, requestPermission });
    _folderCreationInternals.loadDirectoryHandle = async () => savedHandle;
    const saveSpy = vi.fn(async () => undefined);
    _folderCreationInternals.saveDirectoryHandle = saveSpy;

    const pickedLog: string[] = [];
    const { dir: pickedDir } = makeRecordingDir('picked', pickedLog);
    const picker = vi.fn().mockResolvedValue(pickedDir);
    (globalThis as unknown as { window: { showDirectoryPicker: typeof picker } }).window = { showDirectoryPicker: picker };

    const result = await createFoldersOnDesktop(spec);
    expect(result).toBe('MyAlbum');
    expect(picker).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0]?.[0]).toBe(pickedDir);
    // Picked handle is used, not the denied saved one.
    expect(pickedLog).toContain('picked/MyAlbum');
    expect(savedLog).toEqual([]);
  });

  it('returns null and does not save when the user cancels the picker', async () => {
    const saveSpy = vi.fn(async () => undefined);
    _folderCreationInternals.saveDirectoryHandle = saveSpy;

    const abort = new Error('cancelled');
    abort.name = 'AbortError';
    const picker = vi.fn().mockRejectedValue(abort);
    (globalThis as unknown as { window: { showDirectoryPicker: typeof picker } }).window = { showDirectoryPicker: picker };

    const result = await createFoldersOnDesktop(spec);
    expect(result).toBeNull();
    expect(saveSpy).not.toHaveBeenCalled();
  });
});

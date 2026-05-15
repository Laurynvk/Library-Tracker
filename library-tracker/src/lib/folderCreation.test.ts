import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import { saveDirectoryHandle, loadDirectoryHandle, verifyPermission } from './folderCreation';

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

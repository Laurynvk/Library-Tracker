import JSZip from 'jszip';

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
export async function createFoldersOnDesktop(spec: FolderSpec): Promise<string | null> {
  try {
    const dirHandle = await (window as unknown as { showDirectoryPicker: (opts: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' });

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

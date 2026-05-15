import { useEffect, useState } from 'react';
import { useTheme } from '../../lib/theme';
import {
  isFileSystemAccessSupported,
  createFoldersOnDesktop,
  createFoldersAsZip,
  loadDirectoryHandle,
  clearDirectoryHandle,
  type FolderSpec,
} from '../../lib/folderCreation';

export const DEFAULT_FOLDERS = ['_DEMO2MX', 'Tracks', 'Print'];

type Props = {
  albumName: string;
  trackTitle: string;       // empty string if skipped
  folders: string[];
  onFoldersChange: (folders: string[]) => void;
  onFolderPathSet: (path: string) => void;
};

function FolderIcon({ THEME }: { THEME: ReturnType<typeof useTheme> }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={THEME.inkMuted} style={{ flexShrink: 0 }}>
      <path d="M2 4a2 2 0 012-2h3l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" />
    </svg>
  );
}

export function FolderBuilder({ albumName, trackTitle, folders, onFoldersChange, onFolderPathSet }: Props) {
  const THEME = useTheme();
  const fsSupported = isFileSystemAccessSupported();
  const [savedFolderName, setSavedFolderName] = useState<string | null>(null);
  const spec: FolderSpec = {
    albumName: albumName || 'New Album',
    topLevelFolders: folders,
    trackTitle: trackTitle || null,
  };

  useEffect(() => {
    if (!fsSupported) return;
    let cancelled = false;
    loadDirectoryHandle()
      .then((h) => {
        if (!cancelled) setSavedFolderName(h?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setSavedFolderName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fsSupported]);

  async function handleCreateOnDesktop() {
    try {
      const path = await createFoldersOnDesktop(spec);
      if (path) onFolderPathSet(path);
      // Refresh saved name in case this was a first-time pick.
      const h = await loadDirectoryHandle().catch(() => null);
      setSavedFolderName(h?.name ?? null);
    } catch (e) {
      console.error('Folder creation failed:', e);
      alert('Could not create folders. Try downloading as zip instead.');
    }
  }

  async function handleChangeFolder() {
    await clearDirectoryHandle().catch(() => undefined);
    setSavedFolderName(null);
  }

  async function handleDownloadZip() {
    await createFoldersAsZip(spec);
  }

  function updateFolder(index: number, value: string) {
    const next = [...folders];
    next[index] = value;
    onFoldersChange(next);
  }

  function removeFolder(index: number) {
    onFoldersChange(folders.filter((_, i) => i !== index));
  }

  function addFolder() {
    onFoldersChange([...folders, '']);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: THEME.inkMuted }}>
          Folder structure
        </span>
        {albumName && (
          <span style={{ fontSize: 11, color: THEME.inkMuted }}>
            Inside: <code style={{ fontFamily: THEME.mono, fontSize: 11 }}>{albumName}/</code>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {folders.map((name, i) => (
          <div key={i}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <FolderIcon THEME={THEME} />
              <input
                value={name}
                onChange={(e) => updateFolder(i, e.target.value)}
                style={{
                  flex: 1, fontSize: 12.5, color: THEME.ink,
                  background: '#fff', border: `1px solid ${THEME.border}`,
                  borderRadius: 6, padding: '5px 9px',
                  fontFamily: THEME.mono, outline: 'none',
                }}
              />
              <button
                onClick={() => removeFolder(i)}
                style={{
                  width: 24, height: 24, border: 'none', background: 'transparent',
                  color: THEME.border, cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 4, flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* Show track title subfolder hint under Tracks row */}
            {name === 'Tracks' && trackTitle && (
              <div style={{
                marginLeft: 30, marginTop: 3,
                fontSize: 11, color: '#2a6e22', fontFamily: THEME.mono,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="#2a6e22">
                  <path d="M2 4a2 2 0 012-2h3l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" />
                </svg>
                {trackTitle}/
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addFolder}
        style={{
          fontSize: 12, color: THEME.inkSoft, background: 'transparent',
          border: `1px dashed ${THEME.borderStrong}`, borderRadius: 6,
          padding: '5px 10px', cursor: 'pointer', fontFamily: THEME.sans,
          textAlign: 'left',
        }}
      >
        + Add folder
      </button>

      {fsSupported && savedFolderName && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: THEME.inkMuted,
        }}>
          <span>
            Saving to: <code style={{ fontFamily: THEME.mono, fontSize: 11, color: THEME.inkSoft }}>{savedFolderName}</code>
          </span>
          <button
            onClick={handleChangeFolder}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              color: THEME.inkSoft, textDecoration: 'underline', cursor: 'pointer',
              fontFamily: THEME.sans, fontSize: 11,
            }}
          >
            Change folder
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {fsSupported && (
          <button
            onClick={handleCreateOnDesktop}
            style={{
              flex: 1, padding: '8px 12px', background: '#2a6e22', color: '#fff',
              border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: THEME.sans,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            📁 Create on Desktop
          </button>
        )}
        <button
          onClick={handleDownloadZip}
          style={{
            flex: 1, padding: '8px 12px', background: '#fff', color: THEME.inkSoft,
            border: `1px solid ${THEME.border}`, borderRadius: 7, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', fontFamily: THEME.sans,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          ⬇ Download as Zip
        </button>
      </div>
      {!fsSupported && (
        <div style={{ fontSize: 11, color: THEME.inkMuted, fontFamily: THEME.sans }}>
          Use Chrome for automatic folder creation
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTheme, STATUSES, INVOICE_STATES } from '../../lib/theme';
import { updateTrack, deleteTrack } from '../../lib/tracks';
import type { Track } from '../../types/track';
import { ActivityFeed } from './ActivityFeed';
import { DrawerField } from './DrawerField';
import { CopyIconButton } from '../CopyIconButton';
import { resolveFileNamingForCopy, renderTemplate, type NamingTemplates } from '../../lib/settings';
import {
  createTitleFolderUnder,
  isFileSystemAccessSupported,
  loadTrackFolderHandle,
  resolveTrackParentHandle,
  revealTrackFolder,
  saveTrackFolderHandle,
} from '../../lib/folderCreation';

type Props = {
  track: Track | null;
  namingTemplates?: NamingTemplates;
  userInitials?: string;
  defaultVersion?: string;
  onClose: () => void;
  onSave: (updated: Track) => void;
  onDelete?: (id: string) => void;
};

function parseComposers(collaborators: string[]) {
  return collaborators.map((c) => {
    const [initials, pct] = c.split(':');
    return { initials, pct: pct ?? '' };
  });
}

function serializeComposers(rows: { initials: string; pct: string }[]): string[] {
  return rows
    .filter((r) => r.initials.trim())
    .map((r) => r.pct.trim() ? `${r.initials.trim()}:${r.pct.trim()}` : r.initials.trim());
}

function ComposerSplits({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const THEME = useTheme();
  const rows = parseComposers(value.length ? value : []);
  const total = rows.reduce((sum, r) => sum + (Number(r.pct) || 0), 0);
  const totalOk = total === 100;

  function updateRow(idx: number, field: 'initials' | 'pct', val: string) {
    const next = rows.map((r, i) => i === idx ? { ...r, [field]: val } : r);
    onChange(serializeComposers(next));
  }

  function addRow() {
    onChange(serializeComposers([...rows, { initials: '', pct: '' }]));
  }

  function removeRow(idx: number) {
    onChange(serializeComposers(rows.filter((_, i) => i !== idx)));
  }

  const FIELD: CSSProperties = {
    background: THEME.surfaceAlt,
    border: `1px solid ${THEME.border}`,
    borderRadius: 4,
    padding: '5px 7px',
    fontSize: 12.5,
    color: THEME.ink,
    fontFamily: THEME.sans,
    outline: 'none',
  };

  return (
    <div>
      {rows.map((row, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <input
            value={row.initials}
            onChange={(e) => updateRow(idx, 'initials', e.target.value.toUpperCase())}
            placeholder="LL"
            maxLength={4}
            style={{ ...FIELD, width: 52, fontFamily: THEME.mono, textAlign: 'center', fontWeight: 600 }}
          />
          <input
            value={row.pct}
            onChange={(e) => updateRow(idx, 'pct', e.target.value)}
            placeholder="%"
            type="number"
            min={0}
            max={100}
            style={{ ...FIELD, width: 60, fontFamily: THEME.mono, textAlign: 'right' }}
          />
          <span style={{ fontSize: 12, color: THEME.inkMuted }}>%</span>
          <button
            onClick={() => removeRow(idx)}
            style={{
              background: 'none', border: `1px solid ${THEME.border}`,
              borderRadius: 4, width: 22, height: 22,
              color: THEME.inkMuted, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, lineHeight: 1,
            }}
          >×</button>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <button
          onClick={addRow}
          style={{
            background: 'none', border: 'none', padding: 0,
            fontSize: 12, color: THEME.accent, cursor: 'pointer',
            fontFamily: THEME.sans, fontWeight: 500,
          }}
        >+ Add composer</button>
        {rows.length > 0 && (
          <span style={{
            fontSize: 11, fontFamily: THEME.mono, fontWeight: 600,
            color: totalOk ? '#2e7d52' : total > 100 ? '#c44545' : THEME.inkMuted,
          }}>
            = {total}%
          </span>
        )}
      </div>
    </div>
  );
}

export function TrackDrawer({ track, namingTemplates, userInitials, defaultVersion, onClose, onSave, onDelete }: Props) {
  const THEME = useTheme();
  const [draft, setDraft] = useState<Track | null>(track);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [titleFolderPrompt, setTitleFolderPrompt] = useState<{
    title: string;
    parent: FileSystemDirectoryHandle;
    segments: string[];
  } | null>(null);
  const [creatingTitleFolder, setCreatingTitleFolder] = useState(false);
  const [revealMessage, setRevealMessage] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [folderOverride, setFolderOverride] = useState<{ trackId: string; name: string } | null>(null);
  const [changingFolder, setChangingFolder] = useState(false);
  const folderOverrideName = folderOverride && track && folderOverride.trackId === track.id
    ? folderOverride.name
    : null;

  const INPUT_STYLE: CSSProperties = {
    width: '100%',
    background: THEME.surfaceAlt,
    border: `1px solid ${THEME.border}`,
    borderRadius: 4,
    padding: '6px 9px',
    fontSize: 13,
    color: THEME.ink,
    fontFamily: THEME.sans,
    outline: 'none',
  };

  useEffect(() => {
    let cancelled = false;
    if (!track || !isFileSystemAccessSupported()) return () => { cancelled = true; };
    const trackId = track.id;
    loadTrackFolderHandle(trackId)
      .then((h) => {
        if (cancelled) return;
        setFolderOverride(h ? { trackId, name: h.name } : null);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [track]);

  if (!track || !draft) return null;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(track);

  function set<K extends keyof Track>(key: K, value: Track[K]) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function handleSave() {
    if (!draft || !track) return;
    const IMMUTABLE: (keyof Track)[] = ['id', 'created_at', 'activity'];
    const patch: Partial<Track> = {};
    (Object.keys(draft) as (keyof Track)[])
      .filter((k) => !IMMUTABLE.includes(k))
      .forEach((k) => {
        const a = draft[k];
        const b = track[k];
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          (patch as Record<string, unknown>)[k] = a;
        }
      });
    setSaving(true);
    setError(null);
    // Detect that a previously-empty title is now set — we'll offer to create
    // a matching folder once the save succeeds. Skip silently if the FS Access
    // API isn't available; the save path itself must not depend on it.
    const titleWasAdded =
      track.title.trim() === '' && draft.title.trim() !== '';
    const newTitle = draft.title.trim();
    try {
      const updated = await updateTrack(track.id, patch);
      onSave(updated);
      setSaving(false);
      if (titleWasAdded && isFileSystemAccessSupported()) {
        const resolved = await resolveTrackParentHandle(updated.folder_path).catch(() => null);
        if (resolved) {
          setTitleFolderPrompt({
            title: newTitle,
            parent: resolved.parent,
            segments: resolved.segments,
          });
        }
      }
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  async function handleCreateTitleFolder() {
    if (!titleFolderPrompt) return;
    setCreatingTitleFolder(true);
    setError(null);
    try {
      await createTitleFolderUnder(titleFolderPrompt.parent, titleFolderPrompt.title);
      setTitleFolderPrompt(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreatingTitleFolder(false);
    }
  }

  async function handleChangeTitleFolderPath() {
    if (!titleFolderPrompt) return;
    if (!isFileSystemAccessSupported()) return;
    try {
      const picker = (window as unknown as {
        showDirectoryPicker: (opts: object) => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker;
      const picked = await picker({ mode: 'readwrite' });
      setTitleFolderPrompt({
        title: titleFolderPrompt.title,
        parent: picked,
        segments: [picked.name],
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
    }
  }

  async function handleRevealFolder() {
    if (!draft) return;
    setRevealMessage(null);
    const albumFolder = draft.folder_path;
    const title = draft.title.trim();
    if (!albumFolder || !title) {
      setRevealMessage('No local folder is associated with this track yet.');
      return;
    }
    if (!isFileSystemAccessSupported()) {
      setRevealMessage(
        `Open folder requires Chrome/Edge with File System Access. Path: ${albumFolder}/Tracks/${title}`,
      );
      return;
    }
    setRevealing(true);
    try {
      await revealTrackFolder(albumFolder, title, track?.id);
    } catch (e) {
      setRevealMessage((e as Error).message);
    } finally {
      setRevealing(false);
    }
  }

  async function handleChangeFolder() {
    if (!track) return;
    setRevealMessage(null);
    if (!isFileSystemAccessSupported()) {
      setRevealMessage('Change folder requires Chrome/Edge with File System Access.');
      return;
    }
    setChangingFolder(true);
    try {
      const picker = (window as unknown as {
        showDirectoryPicker: (opts: object) => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker;
      const picked = await picker({ mode: 'readwrite' });
      await saveTrackFolderHandle(track.id, picked);
      setFolderOverride({ trackId: track.id, name: picked.name });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setRevealMessage((e as Error).message);
    } finally {
      setChangingFolder(false);
    }
  }

  function handleCancel() {
    setDraft(track);
    setError(null);
  }

  async function handleConfirmDelete() {
    if (!track) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTrack(track.id);
      onDelete?.(track.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <>
      {/* Dim overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(31,27,22,0.28)',
          zIndex: 40,
        }}
      />

      {/* Drawer panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          zIndex: 50,
          background: THEME.surface,
          borderLeft: `1px solid ${THEME.borderStrong}`,
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: THEME.sans,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 18px 13px',
          borderBottom: `1px solid ${THEME.border}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: THEME.mono,
              fontSize: 10,
              color: THEME.inkMuted,
              letterSpacing: 0.3,
              marginBottom: 5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {draft.code ?? '—'}
            </div>
            <input
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: THEME.ink,
                letterSpacing: -0.3,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                padding: 0,
                width: '100%',
                fontFamily: THEME.sans,
              }}
            />
          </div>
          <button
            onClick={onClose}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: THEME.surfaceAlt,
              border: 'none',
              color: THEME.inkSoft,
              fontSize: 17,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body — fields + activity feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {/* Status */}
          <DrawerField label="Status">
            <select
              value={draft.status}
              onChange={(e) => set('status', e.target.value as Track['status'])}
              style={INPUT_STYLE}
            >
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </DrawerField>

          {/* Album */}
          <DrawerField label="Album / Project">
            <input
              type="text"
              value={draft.album ?? ''}
              onChange={(e) => set('album', e.target.value || null)}
              style={INPUT_STYLE}
            />
          </DrawerField>

          {/* Publisher + Due Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DrawerField label="Publisher">
              <input
                type="text"
                value={draft.publisher ?? ''}
                onChange={(e) => set('publisher', e.target.value || null)}
                style={INPUT_STYLE}
              />
            </DrawerField>
            <DrawerField label="Due Date">
              <input
                type="date"
                value={draft.due_date ?? ''}
                onChange={(e) => set('due_date', e.target.value || null)}
                style={INPUT_STYLE}
              />
            </DrawerField>
          </div>

          {/* Fee + Invoice */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DrawerField label="Fee">
              <input
                type="number"
                value={draft.fee ?? ''}
                onChange={(e) => set('fee', e.target.value ? Number(e.target.value) : null)}
                style={INPUT_STYLE}
              />
            </DrawerField>
            <DrawerField label="Invoice">
              <select
                value={draft.invoice}
                onChange={(e) => set('invoice', e.target.value as Track['invoice'])}
                style={INPUT_STYLE}
              >
                {INVOICE_STATES.map((i) => (
                  <option key={i.id} value={i.id}>{i.label}</option>
                ))}
              </select>
            </DrawerField>
          </div>

          {/* Composers & Splits */}
          <DrawerField label="Composers & Splits">
            <ComposerSplits
              value={draft.collaborators}
              onChange={(v) => set('collaborators', v)}
            />
          </DrawerField>

          {/* Publisher Email */}
          <DrawerField label="Publisher Email">
            <input
              type="email"
              value={draft.publisher_email ?? ''}
              onChange={(e) => set('publisher_email', e.target.value || null)}
              style={INPUT_STYLE}
            />
          </DrawerField>

          {/* Brief Link */}
          <DrawerField label="Brief Link">
            <input
              type="text"
              value={draft.brief_link ?? ''}
              onChange={(e) => set('brief_link', e.target.value || null)}
              style={INPUT_STYLE}
            />
          </DrawerField>

          {/* File Naming System */}
          <DrawerField label="File Naming System">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                flex: 1,
                background: THEME.surfaceAlt,
                border: `1px solid ${THEME.border}`,
                borderRadius: 4,
                padding: '6px 9px',
                fontSize: 12,
                color: draft.file_naming ? THEME.inkSoft : THEME.inkMuted,
                fontFamily: THEME.mono,
                fontStyle: draft.file_naming ? 'normal' : 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {draft.file_naming ?? 'Not set'}
              </div>
              {(() => {
                const template = resolveFileNamingForCopy(
                  namingTemplates ?? {},
                  draft.publisher,
                  draft.file_naming,
                );
                const rawVersion = draft.version || defaultVersion || 'v1.00';
                const version = rawVersion.startsWith('v') ? rawVersion : `v${rawVersion}`;
                const copyValue = renderTemplate(
                  template,
                  {
                    code: draft.code,
                    album: draft.album,
                    title: draft.title,
                    version,
                  },
                  userInitials,
                );
                return copyValue ? (
                  <CopyIconButton value={copyValue} title="Copy file naming system" size={13} />
                ) : null;
              })()}
            </div>
          </DrawerField>

          {/* Notes */}
          <DrawerField label="Notes">
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
              rows={3}
              style={{ ...INPUT_STYLE, resize: 'vertical' }}
            />
          </DrawerField>

          {/* Local Folder */}
          <DrawerField
            label="Local Folder"
            accessory={
              <button
                onClick={handleChangeFolder}
                disabled={changingFolder || !isFileSystemAccessSupported()}
                title={
                  isFileSystemAccessSupported()
                    ? 'Pick a different folder for this track'
                    : 'Requires Chrome/Edge with File System Access'
                }
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  color: isFileSystemAccessSupported() && !changingFolder
                    ? THEME.accent
                    : THEME.inkMuted,
                  cursor: isFileSystemAccessSupported() && !changingFolder
                    ? 'pointer'
                    : 'default',
                  fontFamily: THEME.sans,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                {changingFolder ? 'Changing…' : 'Change'}
              </button>
            }
          >
            {(() => {
              const albumFolder = draft.folder_path;
              const title = draft.title.trim();
              const defaultPath = albumFolder && title
                ? `${albumFolder}/Tracks/${title}`
                : albumFolder ?? '—';
              const displayPath = folderOverrideName ?? defaultPath;
              const canReveal = (Boolean(folderOverrideName) || Boolean(albumFolder && title)) && !revealing;
              return (
                <>
                  <div
                    onClick={canReveal ? handleRevealFolder : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 9px',
                      background: THEME.surfaceAlt,
                      border: `1px solid ${THEME.border}`,
                      borderRadius: 4,
                      cursor: canReveal ? 'pointer' : 'default',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke={THEME.inkSoft} strokeWidth="1.4">
                      <path d="M1 3.5C1 2.67 1.67 2 2.5 2H5l1.5 1.5h5C12.33 3.5 13 4.17 13 5v6c0 .83-.67 1.5-1.5 1.5h-9C1.67 12.5 1 11.83 1 11V3.5z" />
                    </svg>
                    <span style={{
                      fontFamily: THEME.mono,
                      fontSize: 10.5,
                      color: THEME.inkSoft,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {displayPath}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canReveal) handleRevealFolder();
                      }}
                      disabled={!canReveal}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: canReveal ? THEME.accent : THEME.inkMuted,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: canReveal ? 'pointer' : 'default',
                        fontFamily: THEME.sans,
                        padding: 0,
                      }}
                    >
                      {revealing ? 'Opening…' : 'Open'}
                    </button>
                  </div>
                  {revealMessage && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: THEME.inkMuted,
                      fontFamily: THEME.sans,
                      lineHeight: 1.4,
                    }}>
                      {revealMessage}
                    </div>
                  )}
                </>
              );
            })()}
          </DrawerField>

          {/* Activity feed */}
          <div style={{ marginTop: 8 }}>
            <div style={{
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: THEME.inkMuted,
              marginBottom: 9,
              fontFamily: THEME.sans,
            }}>
              Activity
            </div>
            <ActivityFeed events={track.activity} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: `1px solid ${THEME.border}`,
          padding: '10px 18px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {confirmingDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 12.5,
                color: THEME.ink,
                marginRight: 'auto',
                fontFamily: THEME.sans,
              }}>
                Are you sure you want to delete this track log?
              </span>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 5,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: THEME.inkSoft,
                  cursor: deleting ? 'default' : 'pointer',
                  fontFamily: THEME.sans,
                }}
              >
                No
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  padding: '6px 16px',
                  background: '#c44545',
                  border: 'none',
                  borderRadius: 5,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: deleting ? 'default' : 'pointer',
                  fontFamily: THEME.sans,
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? 'Deleting…' : 'Yes'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setConfirmingDelete(true)}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: `1px solid #c44545`,
                  borderRadius: 5,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#c44545',
                  cursor: 'pointer',
                  fontFamily: THEME.sans,
                  marginRight: 'auto',
                }}
              >
                Delete
              </button>
              {isDirty && (
                <span style={{ fontSize: 11, color: THEME.inkMuted, fontFamily: THEME.sans }}>
                  Unsaved changes
                </span>
              )}
              <button
                onClick={handleCancel}
                disabled={!isDirty}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 5,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: isDirty ? THEME.inkSoft : THEME.inkMuted,
                  cursor: isDirty ? 'pointer' : 'default',
                  fontFamily: THEME.sans,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                style={{
                  padding: '6px 16px',
                  background: isDirty && !saving ? THEME.accent : THEME.surfaceAlt,
                  border: 'none',
                  borderRadius: 5,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: isDirty && !saving ? '#fff' : THEME.inkMuted,
                  cursor: isDirty && !saving ? 'pointer' : 'default',
                  fontFamily: THEME.sans,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
          {error && (
            <div style={{ fontSize: 11.5, color: '#c44545', fontFamily: THEME.sans }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {titleFolderPrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            fontFamily: THEME.sans,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 460,
              background: THEME.surface,
              borderRadius: 10,
              boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
              padding: '18px 20px 16px',
            }}
          >
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: THEME.ink,
              marginBottom: 10,
              lineHeight: 1.35,
            }}>
              Do you want to make a folder with this track title in the track folder?
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
            }}>
              <div style={{
                flex: 1,
                background: THEME.surfaceAlt,
                border: `1px solid ${THEME.border}`,
                borderRadius: 5,
                padding: '7px 9px',
                fontFamily: THEME.mono,
                fontSize: 11,
                color: THEME.inkSoft,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {[...titleFolderPrompt.segments, titleFolderPrompt.title].join('/')}
              </div>
              <button
                onClick={handleChangeTitleFolderPath}
                disabled={creatingTitleFolder}
                style={{
                  padding: '6px 10px',
                  background: 'transparent',
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 5,
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: THEME.inkSoft,
                  cursor: creatingTitleFolder ? 'default' : 'pointer',
                  fontFamily: THEME.sans,
                  whiteSpace: 'nowrap',
                }}
              >
                Change path
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setTitleFolderPrompt(null)}
                disabled={creatingTitleFolder}
                style={{
                  padding: '7px 16px',
                  background: 'transparent',
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 5,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: THEME.inkSoft,
                  cursor: creatingTitleFolder ? 'default' : 'pointer',
                  fontFamily: THEME.sans,
                }}
              >
                No
              </button>
              <button
                onClick={handleCreateTitleFolder}
                disabled={creatingTitleFolder}
                style={{
                  padding: '7px 18px',
                  background: THEME.accent,
                  border: 'none',
                  borderRadius: 5,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: creatingTitleFolder ? 'default' : 'pointer',
                  fontFamily: THEME.sans,
                  opacity: creatingTitleFolder ? 0.7 : 1,
                }}
              >
                {creatingTitleFolder ? 'Creating…' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { THEME } from '../../lib/theme';
import { updateTrack } from '../../lib/tracks';
import type { Track } from '../../types/track';
import { ActivityFeed } from './ActivityFeed';
// DrawerField imported in Task 4 when fields are added

type Props = {
  track: Track | null;
  onClose: () => void;
  onSave: (updated: Track) => void;
};

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

export function TrackDrawer({ track, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Track | null>(track);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(track);
    setError(null);
  }, [track]);

  if (!track || !draft) return null;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(track);

  function set<K extends keyof Track>(key: K, value: Track[K]) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function handleSave() {
    if (!draft || !track) return;
    const patch: Partial<Track> = {};
    (Object.keys(draft) as (keyof Track)[]).forEach((k) => {
      const a = draft[k];
      const b = track[k];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        (patch as Record<string, unknown>)[k] = a;
      }
    });
    setSaving(true);
    setError(null);
    try {
      const updated = await updateTrack(track.id, patch);
      onSave(updated);
      setSaving(false);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(track);
    setError(null);
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
          {/* Fields — Task 4 */}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
            {isDirty && (
              <span style={{ fontSize: 11, color: THEME.inkMuted, marginRight: 'auto', fontFamily: THEME.sans }}>
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
          {error && (
            <div style={{ fontSize: 11.5, color: '#c44545', fontFamily: THEME.sans }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// INPUT_STYLE exported for reuse by DrawerField in Task 4
export { INPUT_STYLE };

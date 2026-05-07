import { useState } from 'react';
import type { CSSProperties } from 'react';
import { THEME, STATUSES, INVOICE_STATES } from '../../lib/theme';
import { updateTrack } from '../../lib/tracks';
import type { Track } from '../../types/track';
import { ActivityFeed } from './ActivityFeed';
import { DrawerField } from './DrawerField';

type Props = {
  track: Track | null;
  onClose: () => void;
  onSave: (updated: Track) => void;
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

          {/* Notes */}
          <DrawerField label="Notes">
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || null)}
              rows={3}
              style={{ ...INPUT_STYLE, resize: 'vertical' }}
            />
          </DrawerField>

          {/* Local Folder — read-only */}
          <DrawerField label="Local Folder">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 9px',
              background: THEME.surfaceAlt,
              border: `1px solid ${THEME.border}`,
              borderRadius: 4,
            }}>
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
                {draft.folder_path ?? '—'}
              </span>
              <button
                disabled
                style={{
                  background: 'none',
                  border: 'none',
                  color: THEME.inkMuted,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'default',
                  fontFamily: THEME.sans,
                }}
              >
                Open
              </button>
            </div>
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


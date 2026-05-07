# Session 4 — Detail Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an overlay detail drawer that opens when a track row is clicked, showing all fields editable inline, with an explicit Save button and a read-only activity feed.

**Architecture:** Overlay drawer (420px, fixed right) with local controlled draft state. Clicking Save diffs draft against original, patches only changed fields to Supabase, and keeps the drawer open. App owns `selectedTrack` state; TrackTable gets `onRowClick` and `selectedTrackId` props.

**Tech Stack:** React 19, TypeScript, Supabase (`updateTrack` already exists in `lib/tracks.ts`), THEME tokens from `lib/theme.ts`.

**Note on testing:** No test framework is configured. Each task uses `tsc -b --noEmit` for type verification and manual visual checks via `npm run dev`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/TrackDrawer/DrawerField.tsx` | Label + control wrapper |
| Create | `src/components/TrackDrawer/ActivityFeed.tsx` | Read-only event timeline |
| Create | `src/components/TrackDrawer/index.tsx` | Drawer shell, draft state, save/cancel |
| Modify | `src/components/TrackTable/index.tsx` | Add `onRowClick`, `selectedTrackId` props |
| Modify | `src/App.tsx` | Add `selectedTrack` state, render drawer |

---

### Task 1: DrawerField component

**Files:**
- Create: `src/components/TrackDrawer/DrawerField.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/TrackDrawer/DrawerField.tsx
import { THEME } from '../../lib/theme';

type Props = {
  label: string;
  children: React.ReactNode;
};

export function DrawerField({ label, children }: Props) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: THEME.inkMuted,
        marginBottom: 5,
        fontFamily: THEME.sans,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run from `library-tracker/`:
```bash
npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrackDrawer/DrawerField.tsx
git commit -m "feat: add DrawerField label wrapper component"
```

---

### Task 2: ActivityFeed component

**Files:**
- Create: `src/components/TrackDrawer/ActivityFeed.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/TrackDrawer/ActivityFeed.tsx
import { THEME, statusById } from '../../lib/theme';
import type { ActivityEvent } from '../../types/track';

type Props = {
  events: ActivityEvent[];
};

function dotColor(event: ActivityEvent): string {
  switch (event.kind) {
    case 'status_change':
      return statusById(event.to ?? '').color;
    case 'invoice_change':
      return '#c9a14a';
    case 'note':
      return THEME.accent;
    case 'email_matched':
      return '#5a7fb0';
    case 'created':
    default:
      return THEME.inkMuted;
  }
}

function describeEvent(event: ActivityEvent): React.ReactNode {
  switch (event.kind) {
    case 'status_change':
      return <>Status → <strong>{statusById(event.to ?? '').label}</strong></>;
    case 'invoice_change':
      return <>Invoice → <strong>{event.to}</strong></>;
    case 'note':
      return <em>"{event.detail}"</em>;
    case 'email_matched':
      return <>Email matched</>;
    case 'created':
    default:
      return <>Track created</>;
  }
}

function fmtEventTime(at: string): string {
  const d = new Date(at);
  if (isNaN(d.getTime())) return at;
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return 'today ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ActivityFeed({ events }: Props) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div style={{ fontSize: 12, color: THEME.inkMuted, fontFamily: THEME.sans, paddingTop: 4 }}>
        No activity yet.
      </div>
    );
  }

  return (
    <div>
      {sorted.map((event, i) => {
        const isLast = i === sorted.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 9, marginBottom: 8, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: dotColor(event), flexShrink: 0,
              }} />
              {!isLast && (
                <div style={{
                  width: 1, background: THEME.border,
                  flex: 1, marginTop: 3, minHeight: 14,
                }} />
              )}
            </div>
            <div style={{ fontSize: 11.5, color: THEME.inkSoft, lineHeight: 1.45, fontFamily: THEME.sans }}>
              {describeEvent(event)}
              <span style={{ fontSize: 10, color: THEME.inkMuted, marginLeft: 5 }}>
                {fmtEventTime(event.at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrackDrawer/ActivityFeed.tsx
git commit -m "feat: add read-only ActivityFeed component"
```

---

### Task 3: TrackDrawer shell — layout, overlay, header

**Files:**
- Create: `src/components/TrackDrawer/index.tsx`

- [ ] **Step 1: Create the drawer shell with overlay and header only (no fields yet)**

```tsx
// src/components/TrackDrawer/index.tsx
import { useState, useEffect } from 'react';
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

const INPUT_STYLE: React.CSSProperties = {
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrackDrawer/index.tsx
git commit -m "feat: add TrackDrawer shell with overlay, header, footer, and activity feed"
```

---

### Task 4: Wire TrackDrawer fields into the body

**Files:**
- Modify: `src/components/TrackDrawer/index.tsx` (the body section between Header and Activity feed)

- [ ] **Step 1: Replace the `{/* Fields — Task 4 */}` comment with all editable fields**

Find this comment in the Body section:
```tsx
          {/* Fields — Task 4 */}
```

Replace it with:
```tsx
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

          {/* Collaborators */}
          <DrawerField label="Collaborators">
            <input
              type="text"
              value={draft.collaborators.join(', ')}
              onChange={(e) =>
                set('collaborators', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
              }
              placeholder="LL, MK"
              style={INPUT_STYLE}
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
```

Also add these two imports to the top of the file (after the existing imports):
```tsx
import { DrawerField } from './DrawerField';
import { STATUSES, INVOICE_STATES } from '../../lib/theme';
```

- [ ] **Step 2: Type-check**

```bash
npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrackDrawer/index.tsx
git commit -m "feat: add all editable fields to TrackDrawer body"
```

---

### Task 5: Wire TrackTable — onRowClick and selectedTrackId

**Files:**
- Modify: `src/components/TrackTable/index.tsx`

- [ ] **Step 1: Update TrackTable Props type and row rendering**

At the top of `src/components/TrackTable/index.tsx`, change:
```tsx
type Props = {
  tracks: Track[];
  onUpdateInvoice: (id: string, invoice: InvoiceStatus) => void;
};
```
To:
```tsx
type Props = {
  tracks: Track[];
  onUpdateInvoice: (id: string, invoice: InvoiceStatus) => void;
  onRowClick: (track: Track) => void;
  selectedTrackId?: string;
};
```

Update the function signature:
```tsx
export function TrackTable({ tracks, onUpdateInvoice, onRowClick, selectedTrackId }: Props) {
```

Find the row div (the one with `cursor: 'pointer'`) and update it to:
```tsx
          <div
            key={row.id}
            onClick={() => onRowClick(row.original)}
            style={{
              display: 'flex', alignItems: 'center',
              height: 48, padding: ROW_PAD,
              borderBottom: `1px solid ${THEME.border}`,
              cursor: 'pointer',
              fontFamily: THEME.sans,
              transition: 'background .1s',
              background: row.original.id === selectedTrackId ? THEME.rowActive : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (row.original.id !== selectedTrackId) {
                e.currentTarget.style.background = THEME.rowHover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                row.original.id === selectedTrackId ? THEME.rowActive : 'transparent';
            }}>
```

- [ ] **Step 2: Type-check**

```bash
npx tsc -b --noEmit
```
Expected: error — App.tsx not yet passing the new required props. That's fine; it will resolve in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrackTable/index.tsx
git commit -m "feat: add onRowClick and selectedTrackId props to TrackTable"
```

---

### Task 6: Wire App.tsx — selectedTrack state and drawer rendering

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports, state, and handlers**

Add to the existing imports at the top of `src/App.tsx`:
```tsx
import { TrackDrawer } from './components/TrackDrawer';
```

Inside the `App` component, add after the existing `useState` declarations:
```tsx
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
```

Add these two handlers after `handleUpdateInvoice`:
```tsx
  function handleSelectTrack(track: Track) {
    setSelectedTrack(track);
  }

  function handleSaveTrack(updated: Track) {
    setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTrack(updated);
  }
```

- [ ] **Step 2: Update the JSX to pass new props and render the drawer**

Update the `<TrackTable>` call to pass the two new props:
```tsx
      <TrackTable
        tracks={filtered}
        onUpdateInvoice={handleUpdateInvoice}
        onRowClick={handleSelectTrack}
        selectedTrackId={selectedTrack?.id}
      />
```

Add the drawer right before the closing `</div>` of the root container (after `<Footer>`):
```tsx
      <TrackDrawer
        track={selectedTrack}
        onClose={() => setSelectedTrack(null)}
        onSave={handleSaveTrack}
      />
```

Also add `Track` to the existing import if not already there:
```tsx
import type { Track, InvoiceStatus } from './types/track';
```
(`Track` is already imported, `InvoiceStatus` already imported — no change needed.)

- [ ] **Step 3: Type-check**

```bash
npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 4: Visual verification**

```bash
npm run dev
```

Work through the full verification checklist:

1. Click any row → dim appears, drawer slides in from right with that track's data
2. All fields show correct values for the clicked track
3. Active row highlighted in `rowActive` color
4. Edit a field (e.g. change the status dropdown) → "Unsaved changes" label appears, Save activates
5. Click Cancel → field reverts, label disappears
6. Click Save → button shows "Saving…" → row in table updates → drawer stays open with new data
7. Click dim or × → drawer closes, table returns to normal, no active row highlight
8. Click a different row while drawer open → drawer updates to that track instantly
9. Activity feed shows events with colored dots (if any track has activity events; if not, "No activity yet.")
10. Supabase error path: temporarily break the network (DevTools → Network → Offline), click Save → error message appears below buttons

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire TrackDrawer into App — selectedTrack state and handlers"
```

---

## Verification Summary

All 10 items from Step 4 above constitute the full acceptance test for this session. The drawer is complete when all 10 pass.

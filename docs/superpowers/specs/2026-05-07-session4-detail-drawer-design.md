# Session 4 — Detail Drawer Design Spec

**Date:** 2026-05-07
**Status:** Approved

---

## What we're building

A detail drawer that slides in from the right when the user clicks any row in the track table. The drawer shows all of a track's fields, editable inline, with a Save button and a read-only activity feed at the bottom. This is the interaction that makes the app feel like a real tool rather than a spreadsheet.

---

## Layout

**Type:** Overlay — the drawer slides over the full-width table. A dim layer covers the table behind it.

- Drawer width: 420px, `position: fixed`, right edge of viewport, full viewport height
- Dim: `rgba(31,27,22,0.28)` covering everything behind the drawer
- Clicking the dim closes the drawer (same as the × button)
- The table retains all its columns while the drawer is open (no layout shift)

---

## File structure

```
src/components/TrackDrawer/
  index.tsx        — drawer shell, local draft state, save/cancel logic
  DrawerField.tsx  — reusable label + control wrapper (input, select, textarea)
  ActivityFeed.tsx — read-only timeline of ActivityEvents
```

**Modified files:**
- `App.tsx` — adds `selectedTrack` state, `handleSelectTrack`, `handleSaveTrack`, renders drawer + dim
- `TrackTable/index.tsx` — accepts `onRowClick` prop, wires row click handler

---

## Component specs

### TrackDrawer (`index.tsx`)

**Props:**
```ts
type Props = {
  track: Track | null;
  onClose: () => void;
  onSave: (updated: Track) => void;
};
```

**Local state:**
```ts
const [draft, setDraft] = useState<Track | null>(track);
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
const isDirty = draft && track && JSON.stringify(draft) !== JSON.stringify(track);
```

When `track` prop changes, `useEffect` resets `draft` to the new track (handles clicking a different row while drawer is open).

Returns `null` when `track` is null.

**Structure:**
```
<fixed overlay dim — onClick: onClose>
<fixed drawer panel — onClick: stopPropagation>
  <Header (non-scrollable)>
    mono project code (truncated)
    title input (editable, part of draft)
    × close button
  </Header>
  <Body (scrollable, flex: 1, overflow-y: auto)>
    [fields — see below]
    <ActivityFeed events={track.activity} />
  </Body>
  <Footer (non-scrollable)>
    "Unsaved changes" label (only when isDirty)
    Cancel button (ghost) — resets draft to track
    Save button (accent) — disabled when !isDirty, shows spinner when saving
    Error message (below buttons, only when error)
  </Footer>
</fixed drawer panel>
```

**Save flow:**
1. Build patch: iterate `Object.entries(draft)`, comparing each value to `track[k]` using `JSON.stringify` for array fields (`collaborators`) and strict equality for all others
2. `setSaving(true)`, call `updateTrack(track.id, patch)`
3. On success: call `onSave(updatedTrack)`, `setSaving(false)`, clear error. Drawer stays open.
4. On error: `setError(e.message)`, `setSaving(false)`

**Cancel:** resets `draft` to `track`, clears error. No API call.

**Row switch with unsaved changes:** draft resets silently to the new track. No confirm dialog (can be added later if needed).

---

### DrawerField (`DrawerField.tsx`)

```ts
type Props = {
  label: string;
  children: React.ReactNode;
};
```

Renders a label (9.5px, uppercase, letterSpacing 0.8, inkMuted) above the child control. Used for every field in the body.

---

### Field definitions (Body, top to bottom)

| Field | Control | Notes |
|-------|---------|-------|
| Status | `<select>` | All 10 STATUSES from theme.ts |
| Album / Project | `<input type="text">` | |
| Publisher / Due Date | 2-col grid | Due: `<input type="date">` |
| Fee / Invoice | 2-col grid | Fee: `<input type="number">`; Invoice: `<select>` with INVOICE_STATES |
| Collaborators | `<input type="text">` | Display as comma-separated; parse to `string[]` on save |
| Publisher Email | `<input type="email">` | |
| Brief Link | `<input type="text">` | |
| Notes | `<textarea rows={3}>` | resize: vertical |
| Local Folder | read-only display | Folder icon + mono path + "Open" button (no-op this session) |

All editable controls: `background: THEME.surfaceAlt`, `border: 1px solid THEME.border`, `borderRadius: 4`, `padding: 6px 9px`, `fontSize: 13px`, `fontFamily: THEME.sans`, `outline: none`.

---

### ActivityFeed (`ActivityFeed.tsx`)

**Props:** `events: ActivityEvent[]`

Read-only. Events sorted newest-first. Each item:

```
colored dot  →  description text  ·  relative timestamp
             (connector line between items)
```

**Dot colors by kind:**
- `status_change` → status color from `statusById(event.to)`
- `invoice_change` → amber `#c9a14a`
- `note` → accent `#b8593a`
- `email_matched` → blue `#5a7fb0`
- `created` → muted `#8a8276`

**Description text:**
- `status_change`: `Status → {label}`
- `invoice_change`: `Invoice → {to}`
- `note`: `"{detail}"` in italics
- `email_matched`: `Email matched`
- `created`: `Track created`

**Timestamp:** relative for recent events ("today 9:14am", "May 2"), using `fmtDate` for older ones.

Empty state: "No activity yet." in inkMuted.

---

## App.tsx changes

```ts
const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

function handleSelectTrack(track: Track) {
  setSelectedTrack(track);
}

function handleSaveTrack(updated: Track) {
  setTracks(prev => prev.map(t => t.id === updated.id ? updated : t));
  setSelectedTrack(updated); // keep drawer open with fresh data
}
```

Render: wrap the existing layout in a `position: relative` container. Render `<TrackDrawer>` and its dim as siblings inside that container.

---

## TrackTable changes

Add two props:
- `onRowClick: (track: Track) => void` — wired to each row's `onClick`
- `selectedTrackId?: string` — passed from App; the row whose `id === selectedTrackId` gets `THEME.rowActive` background

---

## Styling tokens

All existing THEME tokens. Input/select controls use `surfaceAlt` background, consistent with the prototype. The drawer panel background is `surface` (same as the table). No new tokens needed.

---

## Verification

1. Click any row → overlay dims table, drawer slides in from right with that track's data
2. Edit a field → "Unsaved changes" label appears, Save button activates
3. Click Cancel → fields reset to original values, label disappears
4. Click Save → button shows loading state → track updates in Supabase → table row reflects change → drawer stays open with fresh data
5. Click dim or × → drawer closes, table returns to normal
6. Click a different row while drawer open → drawer updates to new track, no unsaved-changes confirmation
7. Supabase error → error message appears below Save button, drawer stays open
8. Activity feed shows events in chronological order with correct dot colors
9. Empty activity array → "No activity yet." message

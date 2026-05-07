# Session 3 — Track Table Design Spec

**Date:** 2026-05-06  
**Status:** Approved  
**Theme:** Warm Paper

---

## What we're building

The main view of Library Tracker: a sortable, filterable track table with a header bar, filter bar, and stats footer. This replaces the "Connected · 0 tracks" placeholder in App.tsx. No drawer in this session — that's Session 4.

---

## Visual design — Warm Paper tokens

Pulled directly from the Claude Design prototype (`Library Tracker.html`).

```ts
const THEME = {
  bg:           '#f4f1ea',
  surface:      '#fbf9f4',
  surfaceAlt:   '#efeae0',
  border:       'rgba(40, 30, 20, 0.10)',
  borderStrong: 'rgba(40, 30, 20, 0.18)',
  ink:          '#1f1b16',
  inkSoft:      '#5a5249',
  inkMuted:     '#8a8276',
  accent:       '#b8593a',
  accentSoft:   'rgba(184, 89, 58, 0.12)',
  rowHover:     'rgba(40, 30, 20, 0.04)',
  rowActive:    'rgba(184, 89, 58, 0.08)',
  sans:         '"Inter Tight", -apple-system, BlinkMacSystemFont, sans-serif',
  mono:         '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
};
```

Fonts loaded via Google Fonts in `index.html`: Inter Tight + JetBrains Mono.

---

## Status colors

```ts
const STATUSES = [
  { id: 'brief',     label: 'Brief received', color: '#a89b8a' },
  { id: 'writing',   label: 'Writing',        color: '#c9a14a' },
  { id: 'written',   label: 'Written',        color: '#7c8a5c' },
  { id: 'revising',  label: 'Revising',       color: '#b06a3b' },
  { id: 'needs_rev', label: 'Needs revision', color: '#c44545' },
  { id: 'sent',      label: 'Demo sent',      color: '#5a7fb0' },
  { id: 'approved',  label: 'Approved',       color: '#3d8a5f' },
  { id: 'delivered', label: 'Delivered',      color: '#2c2a26' },
  { id: 'hold',      label: 'On hold',        color: '#8a8a8a' },
  { id: 'rejected',  label: 'Rejected',       color: '#6e3535' },
];
```

---

## File structure

```
src/
  components/
    TrackTable/
      index.tsx          — TanStack table: columns, rows, sort
      StatusPill.tsx     — colored dot + label pill
      InvoiceBadge.tsx   — UNPAID/INVOICED/PAID badge, click to cycle → Supabase
    Toolbar/
      index.tsx          — header bar + filter bar (two-row chrome)
    Footer.tsx           — stats bar: N active · Billed · Paid · Outstanding
  lib/
    theme.ts             — THEME object + STATUSES constant
  App.tsx                — owns tracks state, wires everything
  index.html             — add Google Fonts link tags
```

---

## Component specs

### Toolbar (two rows)

**Row 1 — brand bar:**
- Left: "Library" (17px, weight 700) + "LL · N projects" (11px mono, muted)
- Right: Inbox button (outline, inactive), "New from Brief" button (accent filled) — both placeholder/no-op this session

**Row 2 — filter bar:**
- Search input (240px, searches code + title + publisher, case-insensitive)
- Status dropdown (All statuses + each status by label)
- Invoice dropdown (All invoices / Unpaid / Invoiced / Paid)
- Right: "auto-sync · Xm ago" mono label (static text for now)

### TrackTable

**Column definitions (left → right):**

| Column | Width | Notes |
|--------|-------|-------|
| Project Code | 280px fixed | JetBrains Mono, 11.5px |
| Track | flex 1 (min 140px) | 13px, weight 500 |
| Album | 140px fixed | 12.5px, inkSoft |
| Status | 140px fixed | StatusPill component |
| Publisher | 160px fixed | 12.5px, inkSoft, truncate |
| Fee | 80px fixed | Right-aligned, tabular-nums, `$X,XXX` |
| Invoice | 96px fixed | InvoiceBadge component |
| Due | 80px fixed | "May 12" format, inkSoft |

- Sticky header row: 38px tall, uppercase labels, 10.5px, weight 600, letterSpacing 0.8
- Row height: 48px (comfortable) — density toggle is future work
- Row hover: `rowHover` background, no transition delay
- Default sort: `due_date` ascending (soonest first)
- Clicking a column header toggles asc/desc; active column shows ↑/↓
- Empty state: centered "No tracks match this filter." in inkMuted

### StatusPill

Inline-flex pill with a 6px colored dot + status label. Border: 1px `border` color. Background: `surfaceAlt`. Font: 11px, weight 500.

### InvoiceBadge

Small uppercase badge (10.5px, letterSpacing 0.6). 5px colored dot:
- Unpaid → red `#c44545`
- Invoiced → amber `#c9a14a`
- Paid → green `#3d8a5f`

Clicking cycles to the next state and calls `updateTrack()` → saves to Supabase immediately.

### Footer (status bar)

Single row, 36px tall, border-top. Mono font, 11px, inkMuted. Four stats:

- **N active** — tracks not in `delivered` or `rejected`
- **Billed $X** — sum of all fees with invoice ≠ `unpaid`
- **Paid $X** — sum of fees where invoice = `paid`
- **Outstanding $X** — Billed minus Paid

---

## Data & state

- `App.tsx` fetches tracks from Supabase on mount (already wired from Session 2)
- Search, status filter, invoice filter, sort key/direction — all `useState` in App.tsx
- Filtering and sorting happen in-memory (no extra DB calls)
- Invoice cycling: `InvoiceBadge` fires `onUpdate(id, { invoice: nextState })` → App calls `updateTrack()` → Supabase patch

---

## Seed SQL

7 tracks from the prototype, mapped to Supabase schema. Run in SQL Editor before testing.

```sql
insert into public.tracks (title, album, version, code, status, publisher, fee, invoice, due_date, collaborators, folder_path) values
  ('Velvet Hours',  'Midnight Garden', '1.00', 'DCD Midnight Garden v1.00 LL 2mx', 'writing',   'Universal Production Music', 1800, 'unpaid',   '2026-05-22', '{"LL","MK"}',  '~/Desktop/DCD/Midnight Garden/DCD Midnight Garden v1.00 LL 2mx'),
  ('Slow Burn',     'Lowlight',        '2.00', 'DCD Lowlight v2.00 LL 2mx',        'revising',  'APM Music',                  2400, 'invoiced', '2026-05-12', '{"LL"}',       '~/Desktop/DCD/Lowlight/DCD Lowlight v2.00 LL 2mx'),
  ('Paper Skies',   'Paper Skies',     '1.00', 'DCD Paper Skies v1.00 LL 2mx',     'sent',      'Extreme Music',              3200, 'paid',     '2026-04-30', '{"LL","JO"}',  '~/Desktop/DCD/Paper Skies/DCD Paper Skies v1.00 LL 2mx'),
  ('Tide Pull',     'Hollow Coast',    '1.00', 'DCD Hollow Coast v1.00 LL 2mx',    'needs_rev', 'Position Music',             2100, 'unpaid',   '2026-05-08', '{"LL"}',       '~/Desktop/DCD/Hollow Coast/DCD Hollow Coast v1.00 LL 2mx'),
  ('Compass',       'Northstar',       '1.00', 'DCD Northstar v1.00 LL 2mx',       'approved',  'Warner Chappell PM',         2800, 'paid',     '2026-04-18', '{"LL","TR"}',  '~/Desktop/DCD/Northstar/DCD Northstar v1.00 LL 2mx'),
  ('Wingspan',      'Glasswing',       '1.00', 'DCD Glasswing v1.00 LL 2mx',       'delivered', 'Sony PM',                    3500, 'paid',     '2026-03-15', '{"LL"}',       '~/Desktop/DCD/Glasswing/DCD Glasswing v1.00 LL 2mx'),
  ('Halflight',     'Lowlight',        '1.00', 'DCD Lowlight v1.00 LL 2mx',        'brief',     'APM Music',                  2400, 'unpaid',   '2026-05-30', '{"LL"}',       '~/Desktop/DCD/Lowlight/DCD Lowlight v1.00 LL 2mx');
```

---

## Verification

1. Run seed SQL in Supabase → 7 rows appear in Table Editor
2. `npm run dev` → table renders 7 tracks in Warm Paper theme
3. Search "APM" → filters to 2 rows
4. Status dropdown → "Needs revision" → 1 row
5. Click Fee column header → sorts by fee
6. Click an invoice badge → cycles state → Supabase row updates (check Table Editor)
7. Footer totals update correctly after invoice change

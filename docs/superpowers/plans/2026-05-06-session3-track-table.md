# Session 3 — Track Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the main track table view — header bar, filter bar, sortable table, stats footer — in the Warm Paper theme, connected to Supabase.

**Architecture:** App.tsx owns all state (tracks from Supabase, search/filter/sort). Filtering and sorting happen in-memory via useMemo. TanStack React Table handles column definitions, sort state, and row rendering. Components receive data + callbacks as props and know nothing about Supabase.

**Tech Stack:** React 19, TypeScript, TanStack React Table v8, Tailwind CSS (layout only), inline styles for all brand colors, Supabase via existing `src/lib/tracks.ts`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `index.html` | Modify | Add Google Fonts (Inter Tight + JetBrains Mono) |
| `src/lib/theme.ts` | Create | THEME object, STATUSES array, fmtMoney, fmtDate helpers |
| `src/components/TrackTable/StatusPill.tsx` | Create | Colored dot + status label pill |
| `src/components/TrackTable/InvoiceBadge.tsx` | Create | UNPAID/INVOICED/PAID badge, click to cycle |
| `src/components/TrackTable/index.tsx` | Create | TanStack table: 8 columns, sticky header, sort |
| `src/components/Toolbar/index.tsx` | Create | Brand bar (row 1) + filter bar (row 2) |
| `src/components/Footer.tsx` | Create | Stats bar: active count + billed/paid/outstanding |
| `src/App.tsx` | Modify | State, useMemo filter/sort, render all components |

---

## Task 1: Seed data + fonts

**Files:**
- Run: Supabase SQL Editor
- Modify: `index.html`

- [ ] **Step 1: Run seed SQL in Supabase**

Go to your Supabase project → SQL Editor → paste and run:

```sql
insert into public.tracks (title, album, version, code, status, publisher, fee, invoice, due_date, collaborators, folder_path) values
  ('Velvet Hours', 'Midnight Garden', '1.00', 'DCD Midnight Garden v1.00 LL 2mx', 'writing',   'Universal Production Music', 1800, 'unpaid',   '2026-05-22', '{"LL","MK"}', '~/Desktop/DCD/Midnight Garden/DCD Midnight Garden v1.00 LL 2mx'),
  ('Slow Burn',    'Lowlight',        '2.00', 'DCD Lowlight v2.00 LL 2mx',        'revising',  'APM Music',                  2400, 'invoiced', '2026-05-12', '{"LL"}',      '~/Desktop/DCD/Lowlight/DCD Lowlight v2.00 LL 2mx'),
  ('Paper Skies',  'Paper Skies',     '1.00', 'DCD Paper Skies v1.00 LL 2mx',     'sent',      'Extreme Music',              3200, 'paid',     '2026-04-30', '{"LL","JO"}', '~/Desktop/DCD/Paper Skies/DCD Paper Skies v1.00 LL 2mx'),
  ('Tide Pull',    'Hollow Coast',    '1.00', 'DCD Hollow Coast v1.00 LL 2mx',    'needs_rev', 'Position Music',             2100, 'unpaid',   '2026-05-08', '{"LL"}',      '~/Desktop/DCD/Hollow Coast/DCD Hollow Coast v1.00 LL 2mx'),
  ('Compass',      'Northstar',       '1.00', 'DCD Northstar v1.00 LL 2mx',       'approved',  'Warner Chappell PM',         2800, 'paid',     '2026-04-18', '{"LL","TR"}', '~/Desktop/DCD/Northstar/DCD Northstar v1.00 LL 2mx'),
  ('Wingspan',     'Glasswing',       '1.00', 'DCD Glasswing v1.00 LL 2mx',       'delivered', 'Sony PM',                    3500, 'paid',     '2026-03-15', '{"LL"}',      '~/Desktop/DCD/Glasswing/DCD Glasswing v1.00 LL 2mx'),
  ('Halflight',    'Lowlight',        '1.00', 'DCD Lowlight v1.00 LL 2mx',        'brief',     'APM Music',                  2400, 'unpaid',   '2026-05-30', '{"LL"}',      '~/Desktop/DCD/Lowlight/DCD Lowlight v1.00 LL 2mx');
```

Expected: "7 rows affected"

- [ ] **Step 2: Add Google Fonts to index.html**

Replace the contents of `index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Library Tracker</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Google Fonts and seed tracks"
```

---

## Task 2: Theme constants

**Files:**
- Create: `src/lib/theme.ts`

- [ ] **Step 1: Create `src/lib/theme.ts`**

```ts
export const THEME = {
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
} as const;

export type Theme = typeof THEME;

export const STATUSES = [
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
] as const;

export const INVOICE_STATES = [
  { id: 'unpaid',   label: 'Unpaid',   dot: '#c44545' },
  { id: 'invoiced', label: 'Invoiced', dot: '#c9a14a' },
  { id: 'paid',     label: 'Paid',     dot: '#3d8a5f' },
] as const;

export function statusById(id: string) {
  return STATUSES.find((s) => s.id === id) ?? STATUSES[0];
}

export function fmtMoney(n: number | null): string {
  if (n == null) return '—';
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/laurynvk/Documents/ClaudeProjects/LibraryTracker/library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/theme.ts
git commit -m "feat: add theme constants and helpers"
```

---

## Task 3: StatusPill component

**Files:**
- Create: `src/components/TrackTable/StatusPill.tsx`

- [ ] **Step 1: Create `src/components/TrackTable/StatusPill.tsx`**

```tsx
import { statusById, THEME } from '../../lib/theme';

type Props = {
  statusId: string;
};

export function StatusPill({ statusId }: Props) {
  const status = statusById(statusId);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      borderRadius: 999,
      background: THEME.surfaceAlt,
      border: `1px solid ${THEME.border}`,
      color: THEME.ink,
      fontSize: 11,
      fontWeight: 500,
      fontFamily: THEME.sans,
      whiteSpace: 'nowrap',
      letterSpacing: 0.1,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: status.color,
        flexShrink: 0,
      }} />
      {status.label}
    </span>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrackTable/StatusPill.tsx
git commit -m "feat: add StatusPill component"
```

---

## Task 4: InvoiceBadge component

**Files:**
- Create: `src/components/TrackTable/InvoiceBadge.tsx`

- [ ] **Step 1: Create `src/components/TrackTable/InvoiceBadge.tsx`**

```tsx
import { INVOICE_STATES, THEME } from '../../lib/theme';
import type { InvoiceStatus } from '../../types/track';

type Props = {
  value: InvoiceStatus;
  onCycle: (next: InvoiceStatus) => void;
};

const ORDER: InvoiceStatus[] = ['unpaid', 'invoiced', 'paid'];

export function InvoiceBadge({ value, onCycle }: Props) {
  const inv = INVOICE_STATES.find((x) => x.id === value) ?? INVOICE_STATES[0];

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const idx = ORDER.indexOf(value);
    const next = ORDER[(idx + 1) % ORDER.length];
    onCycle(next);
  }

  return (
    <button
      onClick={handleClick}
      title="Click to cycle invoice status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 9px',
        borderRadius: 4,
        background: 'transparent',
        border: `1px solid ${THEME.border}`,
        color: THEME.inkSoft,
        fontSize: 10.5,
        fontWeight: 500,
        fontFamily: THEME.sans,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        cursor: 'pointer',
      }}>
      <span style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: inv.dot,
        flexShrink: 0,
      }} />
      {inv.label}
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrackTable/InvoiceBadge.tsx
git commit -m "feat: add InvoiceBadge component with click-to-cycle"
```

---

## Task 5: TrackTable component

**Files:**
- Create: `src/components/TrackTable/index.tsx`

- [ ] **Step 1: Create `src/components/TrackTable/index.tsx`**

```tsx
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { THEME, fmtMoney, fmtDate } from '../../lib/theme';
import type { Track, InvoiceStatus } from '../../types/track';
import { StatusPill } from './StatusPill';
import { InvoiceBadge } from './InvoiceBadge';

type Props = {
  tracks: Track[];
  onUpdateInvoice: (id: string, invoice: InvoiceStatus) => void;
};

const col = createColumnHelper<Track>();

const columns = [
  col.accessor('code', {
    header: 'Project Code',
    cell: (i) => (
      <span style={{ fontFamily: THEME.mono, fontSize: 11.5, color: THEME.ink, whiteSpace: 'nowrap' }}>
        {i.getValue() ?? '—'}
      </span>
    ),
  }),
  col.accessor('title', {
    header: 'Track',
    cell: (i) => (
      <span style={{ fontSize: 13, fontWeight: 500, color: THEME.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
        {i.getValue()}
      </span>
    ),
  }),
  col.accessor('album', {
    header: 'Album',
    cell: (i) => (
      <span style={{ fontSize: 12.5, color: THEME.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
        {i.getValue() ?? '—'}
      </span>
    ),
  }),
  col.accessor('status', {
    header: 'Status',
    cell: (i) => <StatusPill statusId={i.getValue()} />,
    enableSorting: false,
  }),
  col.accessor('publisher', {
    header: 'Publisher',
    cell: (i) => (
      <span style={{ fontSize: 12.5, color: THEME.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
        {i.getValue() ?? '—'}
      </span>
    ),
  }),
  col.accessor('fee', {
    header: 'Fee',
    cell: (i) => (
      <span style={{ fontSize: 12.5, color: THEME.ink, fontVariantNumeric: 'tabular-nums', display: 'block', textAlign: 'right' }}>
        {fmtMoney(i.getValue())}
      </span>
    ),
  }),
  col.accessor('invoice', {
    header: 'Invoice',
    cell: (i) => (
      <InvoiceBadge
        value={i.getValue()}
        onCycle={(next) => i.table.options.meta?.onUpdateInvoice(i.row.original.id, next)}
      />
    ),
    enableSorting: false,
  }),
  col.accessor('due_date', {
    header: 'Due',
    cell: (i) => (
      <span style={{ fontSize: 12.5, color: THEME.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
        {fmtDate(i.getValue())}
      </span>
    ),
  }),
];

const COL_WIDTHS: Record<string, string> = {
  code:      '0 0 280px',
  title:     '1 1 140px',
  album:     '0 0 140px',
  status:    '0 0 140px',
  publisher: '0 0 160px',
  fee:       '0 0 80px',
  invoice:   '0 0 96px',
  due_date:  '0 0 80px',
};

declare module '@tanstack/react-table' {
  interface TableMeta<TData> {
    onUpdateInvoice: (id: string, invoice: InvoiceStatus) => void;
  }
}

export function TrackTable({ tracks, onUpdateInvoice }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'due_date', desc: false }]);

  const table = useReactTable({
    data: tracks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: { onUpdateInvoice },
  });

  const ROW_PAD = '0 18px';

  return (
    <div style={{ flex: 1, overflow: 'auto', background: THEME.surface }}>
      {/* sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 2,
        display: 'flex', alignItems: 'center',
        height: 38, padding: ROW_PAD,
        background: THEME.surface,
        borderBottom: `1px solid ${THEME.borderStrong}`,
        fontSize: 10.5, fontWeight: 600,
        letterSpacing: 0.8, textTransform: 'uppercase',
        color: THEME.inkMuted, fontFamily: THEME.sans,
      }}>
        {table.getHeaderGroups()[0].headers.map((header) => (
          <div
            key={header.id}
            onClick={header.column.getToggleSortingHandler()}
            style={{
              flex: COL_WIDTHS[header.id] ?? '1 1 100px',
              paddingRight: 12,
              cursor: header.column.getCanSort() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center',
              justifyContent: header.id === 'fee' ? 'flex-end' : 'flex-start',
              gap: 4, userSelect: 'none',
            }}>
            {flexRender(header.column.columnDef.header, header.getContext())}
            {header.column.getIsSorted() === 'asc' && <span style={{ opacity: 0.6, fontSize: 9 }}>↑</span>}
            {header.column.getIsSorted() === 'desc' && <span style={{ opacity: 0.6, fontSize: 9 }}>↓</span>}
          </div>
        ))}
      </div>

      {/* rows */}
      {table.getRowModel().rows.map((row) => (
        <div
          key={row.id}
          style={{
            display: 'flex', alignItems: 'center',
            height: 48, padding: ROW_PAD,
            borderBottom: `1px solid ${THEME.border}`,
            cursor: 'pointer',
            fontFamily: THEME.sans,
            transition: 'background .1s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = THEME.rowHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          {row.getVisibleCells().map((cell) => (
            <div
              key={cell.id}
              style={{
                flex: COL_WIDTHS[cell.column.id] ?? '1 1 100px',
                paddingRight: 12,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: cell.column.id === 'fee' ? 'flex-end' : 'flex-start',
              }}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          ))}
        </div>
      ))}

      {tracks.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center',
          color: THEME.inkMuted, fontSize: 13,
          fontFamily: THEME.sans,
        }}>
          No tracks match this filter.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrackTable/
git commit -m "feat: add TrackTable with TanStack sorting"
```

---

## Task 6: Toolbar component

**Files:**
- Create: `src/components/Toolbar/index.tsx`

- [ ] **Step 1: Create `src/components/Toolbar/index.tsx`**

```tsx
import { THEME, STATUSES, INVOICE_STATES } from '../../lib/theme';

type Props = {
  trackCount: number;
  search: string;
  onSearch: (v: string) => void;
  filterStatus: string;
  onFilterStatus: (v: string) => void;
  filterInvoice: string;
  onFilterInvoice: (v: string) => void;
};

export function Toolbar({
  trackCount,
  search,
  onSearch,
  filterStatus,
  onFilterStatus,
  filterInvoice,
  onFilterInvoice,
}: Props) {
  const selectStyle: React.CSSProperties = {
    height: 30,
    padding: '0 28px 0 10px',
    background: THEME.surfaceAlt,
    border: `1px solid ${THEME.border}`,
    borderRadius: 5,
    fontSize: 12.5,
    color: THEME.ink,
    fontFamily: THEME.sans,
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,0.4)' d='M0 0h10L5 6z'/></svg>")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
  };

  return (
    <>
      {/* Row 1 — brand bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 22px 10px',
        borderBottom: `1px solid ${THEME.border}`,
        background: THEME.bg,
        fontFamily: THEME.sans,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.4, color: THEME.ink }}>
            Library
          </span>
          <span style={{ fontSize: 11, color: THEME.inkMuted, fontFamily: THEME.mono, letterSpacing: 0.4 }}>
            LL · {trackCount} projects
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{
          padding: '7px 12px',
          background: 'transparent',
          color: THEME.inkSoft,
          border: `1px solid ${THEME.border}`,
          borderRadius: 6,
          fontSize: 12.5, fontWeight: 500,
          cursor: 'pointer', fontFamily: THEME.sans,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M2 4l4.5 3.5L11 4M2 3h9v7H2z" />
          </svg>
          Inbox
        </button>
        <button style={{
          padding: '7px 14px',
          background: THEME.accent,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 12.5, fontWeight: 600,
          cursor: 'pointer', fontFamily: THEME.sans,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5.5 1v9M1 5.5h9" />
          </svg>
          New from Brief
        </button>
      </div>

      {/* Row 2 — filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 22px',
        borderBottom: `1px solid ${THEME.borderStrong}`,
        background: THEME.surface,
        fontFamily: THEME.sans,
      }}>
        {/* search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 9px',
          background: THEME.surfaceAlt,
          border: `1px solid ${THEME.border}`,
          borderRadius: 5,
          flex: '0 0 240px',
        }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke={THEME.inkMuted} strokeWidth="1.5">
            <circle cx="4.5" cy="4.5" r="3.5" />
            <path d="M7 7l3 3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search code, title, publisher…"
            style={{
              flex: 1, background: 'transparent',
              border: 'none', outline: 'none',
              fontSize: 12.5, color: THEME.ink,
              fontFamily: THEME.sans,
            }}
          />
        </div>

        {/* status filter */}
        <select value={filterStatus} onChange={(e) => onFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        {/* invoice filter */}
        <select value={filterInvoice} onChange={(e) => onFilterInvoice(e.target.value)} style={selectStyle}>
          <option value="all">All invoices</option>
          {INVOICE_STATES.map((i) => (
            <option key={i.id} value={i.id}>{i.label}</option>
          ))}
        </select>

        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: THEME.inkMuted, fontFamily: THEME.mono }}>
          auto-sync · live
        </span>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Toolbar/
git commit -m "feat: add Toolbar component"
```

---

## Task 7: Footer component

**Files:**
- Create: `src/components/Footer.tsx`

- [ ] **Step 1: Create `src/components/Footer.tsx`**

```tsx
import { THEME, fmtMoney } from '../lib/theme';
import type { Track } from '../types/track';

type Props = {
  tracks: Track[];
};

export function Footer({ tracks }: Props) {
  const active = tracks.filter(
    (t) => t.status !== 'delivered' && t.status !== 'rejected'
  ).length;

  const billed = tracks
    .filter((t) => t.invoice !== 'unpaid')
    .reduce((sum, t) => sum + (t.fee ?? 0), 0);

  const paid = tracks
    .filter((t) => t.invoice === 'paid')
    .reduce((sum, t) => sum + (t.fee ?? 0), 0);

  const outstanding = billed - paid;

  const stat = (label: string, value: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color: THEME.inkMuted }}>{label}</span>
      <span style={{ color: THEME.ink, fontWeight: 500 }}>{value}</span>
    </span>
  );

  return (
    <div style={{
      height: 36,
      padding: '0 22px',
      borderTop: `1px solid ${THEME.borderStrong}`,
      background: THEME.surface,
      display: 'flex', alignItems: 'center', gap: 20,
      fontSize: 11, fontFamily: THEME.mono,
      letterSpacing: 0.3,
      fontVariantNumeric: 'tabular-nums',
      flexShrink: 0,
    }}>
      {stat('Active', String(active))}
      <span style={{ color: THEME.border }}>·</span>
      {stat('Billed', fmtMoney(billed))}
      <span style={{ color: THEME.border }}>·</span>
      {stat('Paid', fmtMoney(paid))}
      <span style={{ color: THEME.border }}>·</span>
      {stat('Outstanding', fmtMoney(outstanding))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.tsx
git commit -m "feat: add Footer stats bar"
```

---

## Task 8: Wire App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useEffect, useState, useMemo } from 'react';
import { fetchTracks, updateTrack } from './lib/tracks';
import { Toolbar } from './components/Toolbar';
import { TrackTable } from './components/TrackTable';
import { Footer } from './components/Footer';
import { THEME } from './lib/theme';
import type { Track, InvoiceStatus } from './types/track';

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterInvoice, setFilterInvoice] = useState('all');

  useEffect(() => {
    fetchTracks()
      .then(setTracks)
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    let list = [...tracks];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        `${t.code ?? ''} ${t.title} ${t.publisher ?? ''}`.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') list = list.filter((t) => t.status === filterStatus);
    if (filterInvoice !== 'all') list = list.filter((t) => t.invoice === filterInvoice);
    return list;
  }, [tracks, search, filterStatus, filterInvoice]);

  async function handleUpdateInvoice(id: string, invoice: InvoiceStatus) {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, invoice } : t))
    );
    try {
      await updateTrack(id, { invoice });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: THEME.sans, color: '#c44545' }}>
        DB error: {error}
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: THEME.bg,
      fontFamily: THEME.sans,
      overflow: 'hidden',
    }}>
      <Toolbar
        trackCount={tracks.length}
        search={search}
        onSearch={setSearch}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
        filterInvoice={filterInvoice}
        onFilterInvoice={setFilterInvoice}
      />
      <TrackTable
        tracks={filtered}
        onUpdateInvoice={handleUpdateInvoice}
      />
      <Footer tracks={tracks} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Check the app in the browser**

```bash
npm run dev
```

Open http://localhost:5175 (or whichever port Vite picks).

Expected:
- Warm Paper background (`#f4f1ea`)
- "Library" header + "LL · 7 projects"
- 7 track rows sorted by due date, soonest first
- Colored status pills
- Invoice badges
- Footer with active count and totals

- [ ] **Step 4: Test filters and invoice cycling**

1. Type "APM" in search → 2 rows remain (Slow Burn, Halflight)
2. Clear search → all 7 rows
3. Status dropdown → "Needs revision" → 1 row (Tide Pull)
4. Invoice dropdown → "Paid" → 3 rows
5. Click an UNPAID badge → cycles to INVOICED → check Supabase Table Editor to confirm save

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire App.tsx — track table with filter, sort, invoice cycling"
```

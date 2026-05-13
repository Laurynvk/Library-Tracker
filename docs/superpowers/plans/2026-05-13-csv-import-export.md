# CSV Import & Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users import their existing spreadsheet into Library Tracker and export their tracks at any time.

**Architecture:** Pure parsing logic lives in `src/lib/csvImport.ts` and `src/lib/csvExport.ts` (easily testable, no React). The 3-step modal lives in `src/components/ImportModal/index.tsx`. Import entry points are the track table empty state and a new Data section in Settings. Export is Settings-only.

**Tech Stack:** React 19, TypeScript, Vite, Supabase, papaparse (already installed), vitest (added in Task 1)

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/lib/csvImport.ts` | CSV parsing, column mapping, status fuzzy match, filter logic |
| Create | `src/lib/csvExport.ts` | Tracks → CSV string, download trigger |
| Create | `src/components/ImportModal/index.tsx` | 3-step import modal (upload → preview+filter → done) |
| Modify | `src/lib/tracks.ts` | Add `importTracks()` bulk insert |
| Modify | `src/components/TrackTable/index.tsx` | Replace empty state with import prompt |
| Modify | `src/components/SettingsModal/index.tsx` | Add Data section (Import + Export) |
| Modify | `src/App.tsx` | Wire up ImportModal state and handlers |
| Create | `src/lib/csvImport.test.ts` | Unit tests for parsing logic |
| Create | `src/lib/csvExport.test.ts` | Unit tests for export logic |

---

## Task 1: Add vitest

**Files:**
- Modify: `library-tracker/package.json`
- Modify: `library-tracker/vite.config.ts`

- [ ] **Step 1: Install vitest**

```bash
cd library-tracker && npm install -D vitest
```

- [ ] **Step 2: Add test script to package.json**

In `library-tracker/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Add vitest config to vite.config.ts**

Read `library-tracker/vite.config.ts` first, then add the `test` block:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

```bash
cd library-tracker && npm test
```

Expected: `No test files found` or similar — no errors.

- [ ] **Step 5: Commit**

```bash
git add library-tracker/package.json library-tracker/package-lock.json library-tracker/vite.config.ts
git commit -m "chore: add vitest"
```

---

## Task 2: CSV import parsing logic

**Files:**
- Create: `library-tracker/src/lib/csvImport.ts`
- Create: `library-tracker/src/lib/csvImport.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `library-tracker/src/lib/csvImport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  fuzzyMatchStatus,
  mapRow,
  applyFilter,
  getFilterValues,
} from './csvImport';

describe('fuzzyMatchStatus', () => {
  it('maps known values', () => {
    expect(fuzzyMatchStatus('sent')).toBe('sent');
    expect(fuzzyMatchStatus('SENT')).toBe('sent');
    expect(fuzzyMatchStatus('Submitted')).toBe('sent');
    expect(fuzzyMatchStatus('in progress')).toBe('writing');
    expect(fuzzyMatchStatus('WIP')).toBe('writing');
    expect(fuzzyMatchStatus('on hold')).toBe('hold');
    expect(fuzzyMatchStatus('passed')).toBe('rejected');
    expect(fuzzyMatchStatus('needs rev')).toBe('needs_rev');
  });

  it('defaults unknown values to brief', () => {
    expect(fuzzyMatchStatus('some random thing')).toBe('brief');
    expect(fuzzyMatchStatus('')).toBe('brief');
  });
});

describe('mapRow', () => {
  it('maps a full row correctly', () => {
    const raw: Record<string, string> = {
      TITLE: 'Summer Drive',
      VERS: 'v1.00',
      'PROJECT CODE': 'APM-001',
      STATUS: 'sent',
      'DATE DUE': '2026-06-01',
      'ALBUM / ORDER': 'Album A',
      LABEL: 'APM Music',
      WRITERS: 'LK, JB',
      FKA: 'Old Title',
      'COMP INT': 'LK',
    };
    const row = mapRow(raw);
    expect(row.title).toBe('Summer Drive');
    expect(row.version).toBe('v1.00');
    expect(row.code).toBe('APM-001');
    expect(row.status).toBe('sent');
    expect(row.album).toBe('Album A');
    expect(row.publisher).toBe('APM Music');
    expect(row.collaborators).toEqual(['LK', 'JB']);
    expect(row.notes).toBe('FKA: Old Title');
    expect(row._comp_int).toBe('LK');
  });

  it('returns null for rows without a title', () => {
    expect(mapRow({ TITLE: '' })).toBeNull();
    expect(mapRow({ TITLE: '   ' })).toBeNull();
  });

  it('handles missing optional fields gracefully', () => {
    const row = mapRow({ TITLE: 'My Track' });
    expect(row).not.toBeNull();
    expect(row!.code).toBeNull();
    expect(row!.album).toBeNull();
    expect(row!.notes).toBeNull();
    expect(row!.collaborators).toEqual([]);
  });
});

describe('applyFilter', () => {
  const rows = [
    { title: 'A', _comp_int: 'LK', publisher: 'APM', status: 'sent', album: 'Vol1' },
    { title: 'B', _comp_int: 'JB', publisher: 'Extreme', status: 'writing', album: 'Vol2' },
    { title: 'C', _comp_int: 'LK', publisher: 'APM', status: 'delivered', album: 'Vol1' },
  ] as Parameters<typeof applyFilter>[0];

  it('filters by initials', () => {
    const result = applyFilter(rows, { type: 'initials', value: 'LK' });
    expect(result).toHaveLength(2);
    expect(result.every((r) => r._comp_int.toLowerCase().includes('lk'))).toBe(true);
  });

  it('filters by label', () => {
    const result = applyFilter(rows, { type: 'label', value: 'APM' });
    expect(result).toHaveLength(2);
  });

  it('filters by status', () => {
    const result = applyFilter(rows, { type: 'status', value: 'sent' });
    expect(result).toHaveLength(1);
  });

  it('returns all rows when filter value is empty', () => {
    expect(applyFilter(rows, { type: 'initials', value: '' })).toHaveLength(3);
    expect(applyFilter(rows, null)).toHaveLength(3);
  });

  it('is case-insensitive', () => {
    expect(applyFilter(rows, { type: 'initials', value: 'lk' })).toHaveLength(2);
  });
});

describe('getFilterValues', () => {
  const rows = [
    { _comp_int: 'LK', publisher: 'APM', status: 'sent', album: 'Vol1' },
    { _comp_int: 'JB', publisher: 'Extreme', status: 'writing', album: 'Vol1' },
    { _comp_int: 'LK', publisher: 'APM', status: 'delivered', album: 'Vol2' },
  ] as Parameters<typeof getFilterValues>[0];

  it('returns unique sorted values for each filter type', () => {
    const vals = getFilterValues(rows);
    expect(vals.initials).toEqual(['JB', 'LK']);
    expect(vals.label).toEqual(['APM', 'Extreme']);
    expect(vals.status).toEqual(['delivered', 'sent', 'writing']);
    expect(vals.album).toEqual(['Vol1', 'Vol2']);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd library-tracker && npm test
```

Expected: All tests fail with `Cannot find module './csvImport'`.

- [ ] **Step 3: Implement csvImport.ts**

Create `library-tracker/src/lib/csvImport.ts`:

```ts
import Papa from 'papaparse';
import type { StatusId } from '../types/track';
import type { NewTrack } from '../types/track';

export type FilterType = 'initials' | 'label' | 'status' | 'album';

export type ImportFilter = {
  type: FilterType;
  value: string;
} | null;

export type ParsedRow = Omit<NewTrack, 'invoice'> & {
  _comp_int: string;
  invoice: 'unpaid';
};

const STATUS_MAP: Record<string, StatusId> = {
  brief: 'brief', new: 'brief', received: 'brief', commissioned: 'brief',
  writing: 'writing', 'in progress': 'writing', wip: 'writing', 'in-progress': 'writing',
  written: 'written', done: 'written', complete: 'written', completed: 'written', finished: 'written',
  revising: 'revising', revision: 'revising', revisions: 'revising',
  'needs rev': 'needs_rev', 'needs revision': 'needs_rev', 'needs revisions': 'needs_rev',
  notes: 'needs_rev', 'needs notes': 'needs_rev',
  sent: 'sent', submitted: 'sent', 'delivered to label': 'sent',
  approved: 'approved', accepted: 'approved',
  delivered: 'delivered',
  hold: 'hold', 'on hold': 'hold',
  rejected: 'rejected', passed: 'rejected', declined: 'rejected', 'no thanks': 'rejected',
};

export function fuzzyMatchStatus(raw: string): StatusId {
  const key = raw.trim().toLowerCase();
  return STATUS_MAP[key] ?? 'brief';
}

function parseDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim());
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

// Normalise a CSV header: trim + uppercase
function h(raw: string): string {
  return raw.trim().toUpperCase();
}

export function mapRow(raw: Record<string, string>): ParsedRow | null {
  // Normalise keys
  const row: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) row[h(k)] = v ?? '';

  const title = row['TITLE']?.trim();
  if (!title) return null;

  const fka = row['FKA']?.trim();

  return {
    title,
    version: row['VERS']?.trim() || 'v1.00',
    code: row['PROJECT CODE']?.trim() || null,
    status: fuzzyMatchStatus(row['STATUS'] ?? ''),
    due_date: parseDate(row['DATE DUE']),
    album: row['ALBUM / ORDER']?.trim() || null,
    publisher: row['LABEL']?.trim() || null,
    collaborators: row['WRITERS']
      ? row['WRITERS'].split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    notes: fka ? `FKA: ${fka}` : null,
    invoice: 'unpaid',
    fee: null,
    publisher_email: null,
    brief_link: null,
    folder_path: null,
    brief_parsed_at: null,
    file_naming: null,
    _comp_int: row['COMP INT']?.trim() ?? '',
  };
}

export function parseCSVText(text: string): { rows: ParsedRow[]; defaultedCount: number } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  let defaultedCount = 0;
  const rows = result.data
    .map((raw) => {
      const row = mapRow(raw);
      if (!row) return null;
      // Count rows where STATUS was non-empty but unrecognised
      const originalStatus = Object.entries(raw).find(([k]) => k.trim().toUpperCase() === 'STATUS')?.[1]?.trim() ?? '';
      const key = originalStatus.toLowerCase();
      if (originalStatus && !(key in STATUS_MAP)) defaultedCount++;
      return row;
    })
    .filter((r): r is ParsedRow => r !== null);
  return { rows, defaultedCount };
}

export function applyFilter(rows: ParsedRow[], filter: ImportFilter): ParsedRow[] {
  if (!filter || !filter.value.trim()) return rows;
  const val = filter.value.trim().toLowerCase();
  return rows.filter((r) => {
    switch (filter.type) {
      case 'initials': return r._comp_int.toLowerCase().includes(val);
      case 'label':    return (r.publisher ?? '').toLowerCase().includes(val);
      case 'status':   return r.status.toLowerCase().includes(val);
      case 'album':    return (r.album ?? '').toLowerCase().includes(val);
    }
  });
}

export function getFilterValues(rows: ParsedRow[]): Record<FilterType, string[]> {
  const sets = {
    initials: new Set<string>(),
    label:    new Set<string>(),
    status:   new Set<string>(),
    album:    new Set<string>(),
  };
  for (const r of rows) {
    if (r._comp_int) sets.initials.add(r._comp_int);
    if (r.publisher)  sets.label.add(r.publisher);
    sets.status.add(r.status);
    if (r.album)      sets.album.add(r.album);
  }
  return {
    initials: [...sets.initials].sort(),
    label:    [...sets.label].sort(),
    status:   [...sets.status].sort(),
    album:    [...sets.album].sort(),
  };
}

// Strip internal _comp_int before inserting into DB
export function parsedRowToNewTrack(row: ParsedRow): NewTrack {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _comp_int, ...track } = row;
  return track;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd library-tracker && npm test
```

Expected: All tests in `csvImport.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add library-tracker/src/lib/csvImport.ts library-tracker/src/lib/csvImport.test.ts
git commit -m "feat: add CSV import parsing logic"
```

---

## Task 3: CSV export logic

**Files:**
- Create: `library-tracker/src/lib/csvExport.ts`
- Create: `library-tracker/src/lib/csvExport.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `library-tracker/src/lib/csvExport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tracksToCSV } from './csvExport';
import type { Track } from '../types/track';

const track: Track = {
  id: '1',
  created_at: '2026-05-01T00:00:00Z',
  code: 'APM-001',
  title: 'Summer Drive',
  album: 'Vol 1',
  version: 'v1.00',
  status: 'sent',
  invoice: 'unpaid',
  due_date: '2026-06-01',
  publisher: 'APM Music',
  publisher_email: null,
  fee: 500,
  brief_link: null,
  folder_path: null,
  brief_parsed_at: null,
  file_naming: null,
  collaborators: ['LK', 'JB'],
  notes: 'FKA: Old Title',
  activity: [],
};

describe('tracksToCSV', () => {
  it('produces a header row', () => {
    const csv = tracksToCSV([track]);
    const header = csv.split('\n')[0];
    expect(header).toContain('Code');
    expect(header).toContain('Title');
    expect(header).toContain('Status');
    expect(header).toContain('Publisher');
  });

  it('produces a data row with correct values', () => {
    const csv = tracksToCSV([track]);
    expect(csv).toContain('APM-001');
    expect(csv).toContain('Summer Drive');
    expect(csv).toContain('sent');
    expect(csv).toContain('APM Music');
    expect(csv).toContain('500');
  });

  it('joins collaborators with semicolons', () => {
    const csv = tracksToCSV([track]);
    expect(csv).toContain('LK;JB');
  });

  it('handles empty tracks array', () => {
    const csv = tracksToCSV([]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(1); // header only
  });

  it('wraps values containing commas in quotes', () => {
    const csv = tracksToCSV([{ ...track, title: 'Hello, World' }]);
    expect(csv).toContain('"Hello, World"');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd library-tracker && npm test
```

Expected: All csvExport tests fail with `Cannot find module './csvExport'`.

- [ ] **Step 3: Implement csvExport.ts**

Create `library-tracker/src/lib/csvExport.ts`:

```ts
import type { Track } from '../types/track';

const HEADERS = [
  'Code', 'Title', 'Version', 'Album', 'Publisher',
  'Status', 'Invoice', 'Fee', 'Due Date',
  'Notes', 'Collaborators', 'Created At',
];

function escape(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function tracksToCSV(tracks: Track[]): string {
  const rows = [
    HEADERS.join(','),
    ...tracks.map((t) =>
      [
        t.code,
        t.title,
        t.version,
        t.album,
        t.publisher,
        t.status,
        t.invoice,
        t.fee,
        t.due_date,
        t.notes,
        t.collaborators.join(';'),
        t.created_at,
      ].map(escape).join(',')
    ),
  ];
  return rows.join('\n');
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd library-tracker && npm test
```

Expected: All tests in both `csvImport.test.ts` and `csvExport.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add library-tracker/src/lib/csvExport.ts library-tracker/src/lib/csvExport.test.ts
git commit -m "feat: add CSV export logic"
```

---

## Task 4: Bulk insert in tracks.ts

**Files:**
- Modify: `library-tracker/src/lib/tracks.ts`

- [ ] **Step 1: Add importTracks function**

Open `library-tracker/src/lib/tracks.ts` and add this function after `createTrack`:

```ts
export async function importTracks(newTracks: NewTrack[]): Promise<Track[]> {
  if (newTracks.length === 0) return [];
  const { data, error } = await supabase
    .from('tracks')
    .insert(newTracks)
    .select();
  if (error) throw error;
  return data as Track[];
}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd library-tracker && npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add library-tracker/src/lib/tracks.ts
git commit -m "feat: add importTracks bulk insert"
```

---

## Task 5: ImportModal component

**Files:**
- Create: `library-tracker/src/components/ImportModal/index.tsx`

- [ ] **Step 1: Create the ImportModal**

Create `library-tracker/src/components/ImportModal/index.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTheme } from '../../lib/theme';
import {
  parseCSVText,
  applyFilter,
  parsedRowToNewTrack,
  type ParsedRow,
  type FilterType,
  type ImportFilter,
} from '../../lib/csvImport';
import { importTracks } from '../../lib/tracks';
import type { Track } from '../../types/track';

type Step = 'upload' | 'preview' | 'done';

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'initials', label: 'Initials' },
  { value: 'label',   label: 'Label' },
  { value: 'status',  label: 'Status' },
  { value: 'album',   label: 'Album' },
];

type Props = {
  onClose: () => void;
  onImported: (tracks: Track[]) => void;
};

export function ImportModal({ onClose, onImported }: Props) {
  const THEME = useTheme();
  const [step, setStep] = useState<Step>('upload');
  const [allRows, setAllRows] = useState<ParsedRow[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('initials');
  const [filterValue, setFilterValue] = useState('');
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const filter: ImportFilter = filterValue.trim()
    ? { type: filterType, value: filterValue }
    : null;

  const visibleRows = applyFilter(allRows, filter);

  const unknownStatusCount = visibleRows.filter((r) => {
    // A row has an unknown status if we defaulted it to 'brief' and original wasn't brief-like
    return false; // tracked via warningCount below
  }).length;

  // Count rows whose original status we couldn't match (we'll track this separately)
  const [warningCount, setWarningCount] = useState(0);

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, defaultedCount } = parseCSVText(text);
      setAllRows(rows);
      setWarningCount(defaultedCount);
      setStep('preview');
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  });

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const newTracks = visibleRows.map(parsedRowToNewTrack);
      const imported = await importTracks(newTracks);
      setImportedCount(imported.length);
      onImported(imported);
      setStep('done');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '5vh 16px', overflowY: 'auto',
  };

  const panel: React.CSSProperties = {
    width: '100%', maxWidth: 540,
    background: THEME.surface, borderRadius: 12,
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
    overflow: 'hidden', fontFamily: THEME.sans,
  };

  const header: React.CSSProperties = {
    padding: '18px 22px 14px', borderBottom: `1px solid ${THEME.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };

  const body: React.CSSProperties = {
    padding: '20px 22px',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px', background: THEME.accent, color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
    cursor: importing ? 'not-allowed' : 'pointer',
    fontFamily: THEME.sans, opacity: importing ? 0.7 : 1,
  };

  const btnGhost: React.CSSProperties = {
    padding: '8px 16px', background: 'transparent', color: THEME.inkMuted,
    border: `1px solid ${THEME.border}`, borderRadius: 6,
    fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: THEME.sans,
  };

  return (
    <div style={overlay}>
      <div style={panel}>
        {/* Header */}
        <div style={header}>
          <span style={{ fontSize: 15, fontWeight: 700, color: THEME.ink, letterSpacing: -0.3 }}>
            {step === 'upload' && 'Import from spreadsheet'}
            {step === 'preview' && `${allRows.length} tracks found`}
            {step === 'done' && 'Import complete'}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: `1px solid ${THEME.border}`,
              background: 'transparent', cursor: 'pointer', fontSize: 16, color: THEME.inkMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={body}>

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div>
              <div
                {...getRootProps()}
                style={{
                  border: `2px dashed ${isDragActive ? THEME.accent : THEME.border}`,
                  borderRadius: 10, padding: '36px 24px',
                  textAlign: 'center', cursor: 'pointer',
                  background: isDragActive ? `${THEME.accent}0a` : THEME.surfaceAlt,
                  transition: 'all .15s',
                  marginBottom: 14,
                }}
              >
                <input {...getInputProps()} />
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: THEME.ink, marginBottom: 4 }}>
                  {isDragActive ? 'Drop it here' : 'Drop your CSV here'}
                </div>
                <div style={{ fontSize: 12, color: THEME.inkMuted, marginBottom: 14 }}>
                  Export from Google Sheets, Excel, or Numbers
                </div>
                <button style={{
                  ...btnPrimary, fontSize: 12, padding: '6px 16px',
                  background: THEME.accent, opacity: 1, cursor: 'pointer',
                }}>
                  Choose file
                </button>
              </div>
              <div style={{ fontSize: 11, color: THEME.inkMuted }}>
                Google Sheets → File → Download → Comma Separated Values (.csv)
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && (
            <div>
              {error && (
                <div style={{
                  background: '#fef0f0', border: '1px solid #f5b0b0',
                  borderRadius: 6, padding: '8px 12px',
                  fontSize: 12, color: '#c44545', marginBottom: 12,
                }}>
                  {error}
                </div>
              )}

              {/* Count + Filter row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: THEME.inkMuted }}>
                  Showing <strong style={{ color: THEME.ink }}>{visibleRows.length}</strong> of {allRows.length}
                </span>

                {/* Compact filter control */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: THEME.inkMuted }}>Filter by</span>
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as FilterType)}
                      style={{
                        background: THEME.surfaceAlt,
                        border: `1px solid ${THEME.border}`,
                        borderRight: 'none',
                        borderRadius: '5px 0 0 5px',
                        padding: '4px 6px',
                        fontSize: 11,
                        color: THEME.ink,
                        cursor: 'pointer',
                        outline: 'none',
                        fontFamily: THEME.sans,
                      }}
                    >
                      {FILTER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      placeholder="type…"
                      style={{
                        background: THEME.surfaceAlt,
                        border: `1px solid ${THEME.border}`,
                        borderRadius: '0 5px 5px 0',
                        padding: '4px 8px',
                        fontSize: 11,
                        color: THEME.ink,
                        width: 60,
                        outline: 'none',
                        fontFamily: THEME.mono,
                        fontWeight: filterValue ? 700 : 400,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Preview table */}
              <div style={{
                border: `1px solid ${THEME.border}`, borderRadius: 8, overflow: 'hidden',
                marginBottom: 12,
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: THEME.surfaceAlt }}>
                      {['Title', 'Publisher', 'Status', 'Due Date'].map((h) => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '7px 10px',
                          fontSize: 10.5, fontWeight: 600, letterSpacing: 0.5,
                          textTransform: 'uppercase', color: THEME.inkMuted,
                          borderBottom: `1px solid ${THEME.border}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.slice(0, 5).map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                        <td style={{ padding: '7px 10px', color: THEME.ink, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</td>
                        <td style={{ padding: '7px 10px', color: THEME.inkSoft }}>{row.publisher ?? '—'}</td>
                        <td style={{ padding: '7px 10px', color: THEME.inkSoft }}>{row.status}</td>
                        <td style={{ padding: '7px 10px', color: THEME.inkSoft }}>{row.due_date ?? '—'}</td>
                      </tr>
                    ))}
                    {visibleRows.length > 5 && (
                      <tr>
                        <td colSpan={4} style={{
                          padding: '7px 10px', textAlign: 'center',
                          color: THEME.inkMuted, fontSize: 11, fontStyle: 'italic',
                        }}>
                          + {visibleRows.length - 5} more rows…
                        </td>
                      </tr>
                    )}
                    {visibleRows.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{
                          padding: '16px 10px', textAlign: 'center',
                          color: THEME.inkMuted, fontSize: 12,
                        }}>
                          No tracks match this filter
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {warningCount > 0 && (
                <div style={{
                  background: '#fffbeb', border: '1px solid #fcd34d',
                  borderRadius: 6, padding: '8px 12px',
                  fontSize: 12, color: '#92400e', marginBottom: 12,
                }}>
                  ⚠ {warningCount} tracks had unrecognised status values — they'll be imported as "brief"
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={btnGhost} onClick={onClose}>Cancel</button>
                <button
                  style={btnPrimary}
                  disabled={importing || visibleRows.length === 0}
                  onClick={handleImport}
                >
                  {importing ? 'Importing…' : `Import ${visibleRows.length} track${visibleRows.length !== 1 ? 's' : ''} →`}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: THEME.ink, marginBottom: 6 }}>
                {importedCount} track{importedCount !== 1 ? 's' : ''} imported
              </div>
              <div style={{ fontSize: 13, color: THEME.inkMuted, marginBottom: 24 }}>
                You can update any statuses from the track table.
              </div>
              <button style={{ ...btnPrimary, cursor: 'pointer', opacity: 1 }} onClick={onClose}>
                Go to my tracks →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd library-tracker && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add library-tracker/src/components/ImportModal/index.tsx
git commit -m "feat: add ImportModal component"
```

---

## Task 6: TrackTable empty state → import prompt

**Files:**
- Modify: `library-tracker/src/components/TrackTable/index.tsx`

- [ ] **Step 1: Add onImportClick prop and update empty state**

In `library-tracker/src/components/TrackTable/index.tsx`, update the `Props` type to add the optional prop:

```ts
type Props = {
  tracks: Track[];
  onUpdateInvoice: (id: string, invoice: InvoiceStatus) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onUpdateVersion: (id: string, version: string) => void;
  onUpdateCode: (id: string, code: string | null) => void;
  onRowClick: (track: Track) => void;
  selectedTrackId?: string;
  userInitials?: string;
  defaultVersion?: string;
  onImportClick?: () => void;  // ← add this
  totalTrackCount?: number;    // ← add this (total before filtering)
};
```

Update the function signature to destructure the new props:

```ts
export function TrackTable({ tracks, onUpdateInvoice, onUpdateTitle, onUpdateVersion, onUpdateCode, onRowClick, selectedTrackId, userInitials, defaultVersion, onImportClick, totalTrackCount }: Props) {
```

Replace the empty state at the bottom of the component (the `tracks.length === 0` block):

```tsx
{tracks.length === 0 && (
  totalTrackCount === 0 ? (
    // True empty state — no tracks at all, show import prompt
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 24px',
      fontFamily: THEME.sans,
    }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>📂</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: THEME.ink, marginBottom: 6 }}>
        No tracks yet
      </div>
      <div style={{ fontSize: 13, color: THEME.inkMuted, marginBottom: 24, textAlign: 'center', maxWidth: 280 }}>
        Bring in your existing spreadsheet or start fresh
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {onImportClick && (
          <button
            onClick={onImportClick}
            style={{
              padding: '9px 18px', background: THEME.accent, color: '#fff',
              border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: THEME.sans,
            }}
          >
            ↑ Import CSV
          </button>
        )}
      </div>
    </div>
  ) : (
    // Filtered empty state — tracks exist but none match filter
    <div style={{
      padding: 60, textAlign: 'center',
      color: THEME.inkMuted, fontSize: 13,
      fontFamily: THEME.sans,
    }}>
      No tracks match this filter.
    </div>
  )
)}
```

- [ ] **Step 2: Verify build**

```bash
cd library-tracker && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add library-tracker/src/components/TrackTable/index.tsx
git commit -m "feat: show import prompt in empty track table"
```

---

## Task 7: Settings modal — Data section

**Files:**
- Modify: `library-tracker/src/components/SettingsModal/index.tsx`

- [ ] **Step 1: Add onImportClick and onExport props**

Update the `Props` type at the top of `SettingsModal/index.tsx`:

```ts
type Props = {
  onClose: () => void;
  onImportClick: () => void;
  onExport: () => void;
};
```

Update the function signature:

```ts
export function SettingsModal({ onClose, onImportClick, onExport }: Props) {
```

- [ ] **Step 2: Add the Data section**

Inside the `<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>` (the settings body), add this section **before** the General section:

```tsx
{/* ── Data ──────────────────────────────── */}
<div>
  <div style={{
    fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
    textTransform: 'uppercase', color: THEME.inkMuted, marginBottom: 12,
  }}>
    Data
  </div>
  <div style={{ display: 'flex', gap: 10 }}>
    <button
      onClick={() => { onClose(); onImportClick(); }}
      style={{
        padding: '8px 14px',
        background: THEME.surfaceAlt,
        border: `1px solid ${THEME.border}`,
        borderRadius: 6, fontSize: 12, fontWeight: 500,
        cursor: 'pointer', color: THEME.ink, fontFamily: THEME.sans,
      }}
    >
      ↑ Import CSV
    </button>
    <button
      onClick={() => { onExport(); onClose(); }}
      style={{
        padding: '8px 14px',
        background: THEME.surfaceAlt,
        border: `1px solid ${THEME.border}`,
        borderRadius: 6, fontSize: 12, fontWeight: 500,
        cursor: 'pointer', color: THEME.ink, fontFamily: THEME.sans,
      }}
    >
      ↓ Export CSV
    </button>
  </div>
  <div style={{ fontSize: 11, color: THEME.inkMuted, marginTop: 8 }}>
    Export downloads all your tracks as a .csv file you can open in any spreadsheet app.
  </div>
</div>
```

- [ ] **Step 3: Verify build**

```bash
cd library-tracker && npm run build
```

Expected: Build may fail with errors about `onImportClick` and `onExport` not being passed — that's expected, fixed in next task.

- [ ] **Step 4: Commit**

```bash
git add library-tracker/src/components/SettingsModal/index.tsx
git commit -m "feat: add Data section to Settings modal"
```

---

## Task 8: Wire everything up in App.tsx

**Files:**
- Modify: `library-tracker/src/App.tsx`

- [ ] **Step 1: Add imports**

At the top of `library-tracker/src/App.tsx`, add:

```ts
import { ImportModal } from './components/ImportModal';
import { tracksToCSV, downloadCSV } from './lib/csvExport';
import type { Track } from './types/track';
```

- [ ] **Step 2: Add importOpen state**

Inside the `App` component, after the existing `useState` declarations, add:

```ts
const [importOpen, setImportOpen] = useState(false);
```

- [ ] **Step 3: Add handleImported and handleExport functions**

After the existing handler functions, add:

```ts
function handleImported(newTracks: Track[]) {
  setTracks((prev) => [...prev, ...newTracks]);
  setImportOpen(false);
}

function handleExport() {
  const filename = `library-tracker-export-${new Date().toISOString().split('T')[0]}.csv`;
  downloadCSV(filename, tracksToCSV(tracks));
}
```

- [ ] **Step 4: Pass new props to TrackTable**

Find the `<TrackTable` usage and add:

```tsx
onImportClick={() => setImportOpen(true)}
totalTrackCount={tracks.length}
```

- [ ] **Step 5: Pass new props to SettingsModal**

Find the `<SettingsModal` usage and add:

```tsx
onImportClick={() => { setSettingsOpen(false); setImportOpen(true); }}
onExport={handleExport}
```

- [ ] **Step 6: Render ImportModal**

After the existing modal renders (`<BriefModal .../>`, `<SettingsModal .../>` etc.), add:

```tsx
{importOpen && (
  <ImportModal
    onClose={() => setImportOpen(false)}
    onImported={handleImported}
  />
)}
```

- [ ] **Step 7: Verify full build**

```bash
cd library-tracker && npm run build
```

Expected: Build succeeds with zero TypeScript errors.

- [ ] **Step 8: Run all tests**

```bash
cd library-tracker && npm test
```

Expected: All tests pass.

- [ ] **Step 9: Final commit**

```bash
git add library-tracker/src/App.tsx
git commit -m "feat: wire up CSV import and export in App"
```

---

## Manual Acceptance Tests

Run `npm run dev` and test these scenarios by hand:

### Import

- [ ] **Empty state prompt** — With no tracks in the DB, the track table shows "No tracks yet" with an "↑ Import CSV" button
- [ ] **Settings entry point** — Open Settings → Data section shows Import and Export buttons
- [ ] **Upload step** — Clicking Import opens the modal; drag-and-drop a CSV file works; clicking "Choose file" opens a file picker
- [ ] **Non-CSV file rejected** — Dragging a .xlsx or .pdf file does nothing
- [ ] **Preview step** — After dropping a valid CSV, step 2 shows the track count and a table of the first 5 rows
- [ ] **Filter by initials** — Typing "LK" in the filter input narrows the table and updates the count
- [ ] **Filter type switch** — Changing the dropdown from Initials to Label and typing "APM" filters by publisher instead
- [ ] **Empty filter** — Clearing the filter input shows all tracks again
- [ ] **Import button count** — The "Import X tracks →" button reflects the filtered count, not the total
- [ ] **Import succeeds** — Clicking Import shows the done screen with the correct count
- [ ] **Tracks appear** — Closing the modal shows the imported tracks in the table
- [ ] **Filtered empty state** — After importing tracks, searching for something that matches nothing shows "No tracks match this filter" (not the import prompt)

### Export

- [ ] **Export downloads** — Clicking Export CSV in Settings triggers a file download
- [ ] **Filename format** — Downloaded file is named `library-tracker-export-YYYY-MM-DD.csv`
- [ ] **File opens in spreadsheet** — Drag the file into Google Sheets or Numbers; all columns appear correctly
- [ ] **Collaborators** — Collaborators are joined with semicolons in the CSV

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
  const existingNotes = row['NOTES']?.trim();

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
      : row['COLLABORATORS']
      ? row['COLLABORATORS'].split(';').map((s) => s.trim()).filter(Boolean)
      : [],
    notes: fka ? `FKA: ${fka}` : existingNotes || null,
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
      default: return true;
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

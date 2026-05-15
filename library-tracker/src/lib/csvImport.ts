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
  brief: 'brief', new: 'brief', received: 'brief', commissioned: 'brief', briefed: 'brief',
  writing: 'writing', 'in progress': 'writing', wip: 'writing', 'in-progress': 'writing',
  written: 'written', done: 'written', complete: 'written', completed: 'written', finished: 'written',
  revising: 'revising', revision: 'revising', revisions: 'revising',
  'needs rev': 'needs_rev', 'needs revision': 'needs_rev', 'needs revisions': 'needs_rev',
  'awaiting rev review': 'needs_rev', 'awaiting revision review': 'needs_rev',
  notes: 'needs_rev', 'needs notes': 'needs_rev',
  sent: 'sent', submitted: 'sent', 'delivered to label': 'sent',
  approved: 'approved', accepted: 'approved',
  delivered: 'delivered',
  hold: 'hold', 'on hold': 'hold', holding: 'hold',
  rejected: 'rejected', passed: 'rejected', declined: 'rejected', 'no thanks': 'rejected',
};

export function fuzzyMatchStatus(raw: string): StatusId {
  // Strip leading numeric prefix and trailing punctuation
  const stripped = raw.trim()
    .replace(/^\d+\s*[-–.\)]\s*/, '')
    .replace(/[:.;,]+$/, '');
  const key = stripped.toLowerCase();

  if (STATUS_MAP[key]) return STATUS_MAP[key];

  // Contains fallback: "Sent to client", "On Hold (pending)", etc.
  // Prefer the longest matching key to avoid short keys shadowing longer ones.
  let best: StatusId | null = null;
  let bestLen = 0;
  for (const [mapKey, statusId] of Object.entries(STATUS_MAP)) {
    if (key.includes(mapKey) && mapKey.length > bestLen) {
      best = statusId;
      bestLen = mapKey.length;
    }
  }
  return best ?? 'brief';
}

function parseDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim());
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

// Normalise a CSV header: strip BOM + trim + uppercase.
// Excel / Google Sheets exports often start with a UTF-8 BOM (U+FEFF)
// which would otherwise leave the first header un-matchable.
function h(raw: string): string {
  const stripped = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return stripped.trim().toUpperCase();
}

// Look up a value from the row by trying multiple header aliases.
// Useful so that the app's own CSV export (which uses "Publisher",
// "Due Date", etc.) can be round-tripped through import.
function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v.trim() !== '') return v;
  }
  return '';
}

export function mapRow(raw: Record<string, string>): ParsedRow | null {
  // Normalise keys
  const row: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) row[h(k)] = v ?? '';

  const title = pick(row, 'TITLE', 'TRACK', 'TRACK TITLE', 'NAME').trim();
  if (!title) return null;

  const fka = row['FKA']?.trim();
  const existingNotes = pick(row, 'NOTES', 'NOTE').trim();
  const collabRaw = pick(row, 'WRITERS', 'COLLABORATORS', 'COLLABS');
  const collabSeparator = collabRaw.includes(';') ? ';' : ',';

  return {
    title,
    version: pick(row, 'VERS', 'VERSION').trim() || 'v1.00',
    code: pick(row, 'PROJECT CODE', 'CODE').trim() || null,
    status: fuzzyMatchStatus(pick(row, 'STATUS')),
    due_date: parseDate(pick(row, 'DATE DUE', 'DUE DATE', 'DUE')),
    album: pick(row, 'ALBUM / ORDER', 'ALBUM', 'ORDER').trim() || null,
    publisher: pick(row, 'LABEL', 'PUBLISHER').trim() || null,
    collaborators: collabRaw
      ? collabRaw.split(collabSeparator).map((s) => s.trim()).filter(Boolean)
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

const TITLE_ALIASES = new Set(['TITLE', 'TRACK', 'TRACK TITLE', 'NAME']);

export function parseCSVText(text: string): { rows: ParsedRow[]; defaultedCount: number; detectedHeaders: string[] } {
  // Strip a leading UTF-8 BOM (U+FEFF).
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  // Parse without headers first so we can locate the real header row ourselves.
  // Google Sheets sometimes exports hidden rows (or skips them), meaning the
  // row containing "TITLE" may not be the first row in the file.
  const raw = Papa.parse<string[]>(cleaned, { header: false, skipEmptyLines: true });
  const allRows = raw.data;
  if (allRows.length === 0) return { rows: [], defaultedCount: 0, detectedHeaders: [] };

  // Find the first row that contains a recognised title-column alias.
  const headerIdx = allRows.findIndex((row) =>
    row.some((cell) => TITLE_ALIASES.has((cell ?? '').trim().toUpperCase()))
  );
  const effectiveHeaderIdx = headerIdx >= 0 ? headerIdx : 0;
  const headers = allRows[effectiveHeaderIdx].map((c) => (c ?? '').trim());
  const detectedHeaders = headers;

  // Convert subsequent rows into keyed records using those headers.
  const records: Record<string, string>[] = allRows.slice(effectiveHeaderIdx + 1).map((row) => {
    const rec: Record<string, string> = {};
    headers.forEach((hdr, i) => { rec[hdr] = row[i] ?? ''; });
    return rec;
  });

  let defaultedCount = 0;
  const rows = records
    .map((rec) => {
      const row = mapRow(rec);
      if (!row) return null;
      const originalStatus = Object.entries(rec).find(([k]) => k.trim().toUpperCase() === 'STATUS')?.[1]?.trim() ?? '';
      const key = originalStatus.toLowerCase();
      if (originalStatus && !(key in STATUS_MAP)) defaultedCount++;
      return row;
    })
    .filter((r): r is ParsedRow => r !== null);

  return { rows, defaultedCount, detectedHeaders };
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

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
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

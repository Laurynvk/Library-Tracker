import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useState, useRef } from 'react';
import { THEME, fmtMoney, fmtDate } from '../../lib/theme';
import type { Track, InvoiceStatus } from '../../types/track';
import { StatusPill } from './StatusPill';
import { InvoiceBadge } from './InvoiceBadge';

type Props = {
  tracks: Track[];
  onUpdateInvoice: (id: string, invoice: InvoiceStatus) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onRowClick: (track: Track) => void;
  selectedTrackId?: string;
};

function EditableTitle({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed !== value) onCommit(trimmed);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        style={{
          fontSize: 13, fontWeight: 500, color: THEME.ink,
          background: THEME.surfaceAlt,
          border: `1px solid ${THEME.accent}`,
          borderRadius: 4,
          padding: '2px 6px',
          width: '100%',
          fontFamily: THEME.sans,
          outline: 'none',
        }}
      />
    );
  }

  const isEmpty = !value;
  return (
    <span
      onClick={startEdit}
      style={{
        fontSize: 13, fontWeight: isEmpty ? 400 : 500,
        color: isEmpty ? THEME.inkMuted : THEME.ink,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
        cursor: 'text',
        padding: '2px 0',
        fontStyle: isEmpty ? 'italic' : 'normal',
      }}
    >
      {isEmpty ? 'Add title' : value}
    </span>
  );
}

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
    header: 'Track Title',
    cell: (i) => (
      <EditableTitle
        value={i.getValue()}
        onCommit={(title) => i.table.options.meta?.onUpdateTitle(i.row.original.id, title)}
      />
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData> {
    onUpdateInvoice: (id: string, invoice: InvoiceStatus) => void;
    onUpdateTitle: (id: string, title: string) => void;
  }
}

export function TrackTable({ tracks, onUpdateInvoice, onUpdateTitle, onRowClick, selectedTrackId }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'due_date', desc: false }]);

  const table = useReactTable({
    data: tracks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: { onUpdateInvoice, onUpdateTitle },
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
          {row.getVisibleCells().map((cell) => (
            <div
              key={cell.id}
              onClick={cell.column.id === 'title' ? (e) => e.stopPropagation() : undefined}
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

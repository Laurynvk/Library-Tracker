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
  onRowClick: (track: Track) => void;
  selectedTrackId?: string;
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

export function TrackTable({ tracks, onUpdateInvoice, onRowClick, selectedTrackId }: Props) {
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

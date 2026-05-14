import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useState, useRef, useMemo } from 'react';
import { useTheme, fmtMoney, fmtDate } from '../../lib/theme';
import type { Track, InvoiceStatus } from '../../types/track';
import { StatusPill } from './StatusPill';
import { InvoiceBadge } from './InvoiceBadge';
import { CopyIconButton } from '../CopyIconButton';
import { resolveFileNamingForCopy, renderTemplate, type NamingTemplates } from '../../lib/settings';

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
  namingTemplates?: NamingTemplates;
  onImportClick?: () => void;
  totalTrackCount?: number;
};

function EditableCode({ value, onCommit }: { value: string | null; onCommit: (v: string | null) => void }) {
  const THEME = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  function commit() {
    const trimmed = draft.trim();
    const next = trimmed || null;
    if (next !== value) onCommit(next);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        style={{
          fontSize: 11.5, fontFamily: THEME.mono, color: THEME.ink,
          background: THEME.surfaceAlt,
          border: `1px solid ${THEME.accent}`,
          borderRadius: 4,
          padding: '2px 6px',
          width: '100%',
          outline: 'none',
        }}
      />
    );
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); setDraft(value ?? ''); setEditing(true); }}
      title="Click to edit project code"
      style={{
        fontFamily: THEME.mono, fontSize: 11.5,
        color: value ? THEME.ink : THEME.inkMuted,
        fontStyle: value ? 'normal' : 'italic',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
        cursor: 'text',
      }}
    >
      {value ?? 'Add code'}
    </span>
  );
}

function EditableVersion({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const THEME = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

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
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        style={{
          fontSize: 11.5, fontFamily: THEME.mono, color: THEME.ink,
          background: THEME.surfaceAlt,
          border: `1px solid ${THEME.accent}`,
          borderRadius: 4,
          padding: '2px 5px',
          width: 68,
          outline: 'none',
        }}
      />
    );
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      title="Click to edit version"
      style={{
        fontSize: 11.5, fontFamily: THEME.mono,
        color: THEME.inkSoft,
        background: THEME.surfaceAlt,
        border: `1px solid ${THEME.border}`,
        borderRadius: 4,
        padding: '2px 6px',
        cursor: 'text',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {value || 'v1.00'}
    </span>
  );
}

function EditableTitle({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const THEME = useTheme();
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

function TitleWithCopy({ title, copyValue, onCommit }: { title: string; copyValue: string; onCommit: (v: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, width: '100%' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <EditableTitle value={title} onCommit={onCommit} />
      {hovered && (
        <CopyIconButton value={copyValue || title} title="Copy file naming system" size={12} />
      )}
    </div>
  );
}

function parseSplits(collaborators: string[]): { initials: string; pct: number | null }[] {
  return collaborators.map((c) => {
    const [initials, pct] = c.split(':');
    return { initials, pct: pct != null ? Number(pct) : null };
  });
}

function formatSplitsInline(collaborators: string[], userInitials?: string): string {
  const splits = parseSplits(collaborators);
  const hasUser = userInitials && splits.some((s) => s.initials === userInitials);
  const parts: string[] = [];
  if (userInitials && !hasUser) parts.push(userInitials);
  splits.forEach(({ initials, pct }) => parts.push(pct != null ? `${initials} ${pct}%` : initials));
  return parts.length ? parts.join(' / ') : '—';
}

function normalizeVersion(raw: string, defaultVersion?: string): string {
  const v = raw || defaultVersion || 'v1.00';
  return v.startsWith('v') ? v : `v${v}`;
}

const col = createColumnHelper<Track>();

const COL_WIDTHS: Record<string, string> = {
  code:          '0 0 220px',
  title:         '1 1 140px',
  version:       '0 0 76px',
  album:         '0 0 120px',
  publisher:     '0 0 140px',
  status:        '0 0 130px',
  due_date:      '0 0 72px',
  fee:           '0 0 76px',
  invoice:       '0 0 90px',
  collaborators: '0 0 150px',
};

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData> {
    onUpdateInvoice: (id: string, invoice: InvoiceStatus) => void;
    onUpdateTitle: (id: string, title: string) => void;
    onUpdateVersion: (id: string, version: string) => void;
    onUpdateCode: (id: string, code: string | null) => void;
  }
}

export function TrackTable({ tracks, onUpdateInvoice, onUpdateTitle, onUpdateVersion, onUpdateCode, onRowClick, selectedTrackId, userInitials, defaultVersion, namingTemplates, onImportClick, totalTrackCount }: Props) {
  const THEME = useTheme();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'due_date', desc: false }]);

  // Column order: Code > Title > Version > Album > Publisher > Status > Due > Fee > Invoice > Splits
  const columns = useMemo(
    () => [
      col.accessor('code', {
        header: 'Project Code',
        cell: (i) => (
          <EditableCode
            value={i.getValue()}
            onCommit={(code) => i.table.options.meta?.onUpdateCode(i.row.original.id, code)}
          />
        ),
      }),
      col.accessor('title', {
        header: 'Track Title',
        cell: (i) => (
          <TitleWithCopy
            title={i.getValue()}
            copyValue={renderTemplate(
              resolveFileNamingForCopy(
                namingTemplates ?? {},
                i.row.original.publisher,
                i.row.original.file_naming,
              ),
              {
                code: i.row.original.code,
                album: i.row.original.album,
                title: i.row.original.title,
                version: normalizeVersion(i.row.original.version, defaultVersion),
              },
              userInitials,
            )}
            onCommit={(title) => i.table.options.meta?.onUpdateTitle(i.row.original.id, title)}
          />
        ),
      }),
      col.accessor('version', {
        header: 'Version',
        cell: (i) => (
          <EditableVersion
            value={normalizeVersion(i.getValue(), defaultVersion)}
            onCommit={(version) => i.table.options.meta?.onUpdateVersion(i.row.original.id, version)}
          />
        ),
        enableSorting: false,
      }),
      col.accessor('album', {
        header: 'Album',
        cell: (i) => (
          <span style={{ fontSize: 12.5, color: THEME.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
            {i.getValue() ?? '—'}
          </span>
        ),
      }),
      col.accessor('publisher', {
        header: 'Publisher',
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
      col.accessor('due_date', {
        header: 'Due',
        cell: (i) => (
          <span style={{ fontSize: 12.5, color: THEME.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
            {fmtDate(i.getValue())}
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
      col.accessor('collaborators', {
        header: 'Splits',
        cell: (i) => (
          <span style={{
            fontSize: 12, color: THEME.inkSoft,
            fontFamily: THEME.mono,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
          }}>
            {formatSplitsInline(i.getValue(), userInitials)}
          </span>
        ),
        enableSorting: false,
      }),
    ],
    [THEME, userInitials, defaultVersion, namingTemplates],
  );

  const table = useReactTable({
    data: tracks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: { onUpdateInvoice, onUpdateTitle, onUpdateVersion, onUpdateCode },
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
              onClick={(['title', 'version', 'code'] as string[]).includes(cell.column.id) ? (e) => e.stopPropagation() : undefined}
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
    </div>
  );
}

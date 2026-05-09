import { useTheme, STATUSES, INVOICE_STATES } from '../../lib/theme';

type Props = {
  trackCount: number;
  search: string;
  onSearch: (v: string) => void;
  filterStatus: string;
  onFilterStatus: (v: string) => void;
  filterInvoice: string;
  onFilterInvoice: (v: string) => void;
  inboxPendingCount: number;
  onInboxOpen: () => void;
  onNewFromBrief: () => void;
  onSettingsOpen: () => void;
};

export function Toolbar({
  trackCount,
  search,
  onSearch,
  filterStatus,
  onFilterStatus,
  filterInvoice,
  onFilterInvoice,
  inboxPendingCount,
  onInboxOpen,
  onNewFromBrief,
  onSettingsOpen,
}: Props) {
  const THEME = useTheme();
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
        <button
          onClick={onInboxOpen}
          style={{
            position: 'relative',
            padding: '7px 12px',
            background: 'transparent',
            color: THEME.inkSoft,
            border: `1px solid ${THEME.border}`,
            borderRadius: 6,
            fontSize: 12.5, fontWeight: 500,
            cursor: 'pointer', fontFamily: THEME.sans,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M2 4l4.5 3.5L11 4M2 3h9v7H2z" />
          </svg>
          Inbox
          {inboxPendingCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -5, right: -5,
              background: THEME.accent,
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              minWidth: 16, height: 16,
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px',
            }}>
              {inboxPendingCount}
            </span>
          )}
        </button>
        <button
          onClick={onNewFromBrief}
          style={{
            padding: '7px 14px',
            background: THEME.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: THEME.sans,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5.5 1v9M1 5.5h9" />
          </svg>
          New Brief
        </button>
        <button
          onClick={onSettingsOpen}
          title="Settings"
          style={{
            padding: '7px 10px',
            background: 'transparent',
            color: THEME.inkSoft,
            border: `1px solid ${THEME.border}`,
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7" cy="7" r="2" />
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" strokeLinecap="round"/>
          </svg>
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

        <select value={filterStatus} onChange={(e) => onFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

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

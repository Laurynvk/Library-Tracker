import { useState } from 'react';
import { THEME, statusById, fmtDate } from '../../lib/theme';
import type { InboxItem } from '../../types/track';

type Props = {
  item: InboxItem;
  onApprove: (item: InboxItem) => Promise<void>;
  onDismiss: (itemId: string) => Promise<void>;
  onViewEmail?: (rawEmail: string) => void;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return fmtDate(iso);
}

export function ProposalCard({ item, onApprove, onDismiss, onViewEmail }: Props) {
  const [loading, setLoading] = useState<'approve' | 'dismiss' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMatched = item.track_id !== null && item.proposed_status !== null;
  const proposedStatus = item.proposed_status ? statusById(item.proposed_status) : null;
  const currentStatus = item.current_status ? statusById(item.current_status) : null;
  const dotColor = proposedStatus?.color ?? THEME.inkMuted;

  async function handleApprove() {
    setLoading('approve');
    setError(null);
    try {
      await onApprove(item);
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  }

  async function handleDismiss() {
    setLoading('dismiss');
    setError(null);
    try {
      await onDismiss(item.id);
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  }

  const btnBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 4,
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 500,
    cursor: loading ? 'default' : 'pointer',
    fontFamily: THEME.sans,
    opacity: loading ? 0.6 : 1,
  };

  return (
    <div style={{
      background: THEME.surface,
      border: `1px solid ${THEME.border}`,
      borderLeft: `3px solid ${dotColor}`,
      borderRadius: 5,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: THEME.ink }}>
          {isMatched ? item.subject.replace(/^(Re:|Fwd:)\s*/i, '') : item.subject}
        </span>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 10, color: THEME.inkMuted }}>
        {item.sender} · {relativeTime(item.created_at)}
      </div>

      {/* Excerpt */}
      <div style={{ fontSize: 11, color: THEME.inkSoft, fontStyle: 'italic', lineHeight: 1.5 }}>
        "{item.excerpt}"
      </div>

      {/* Status change pill */}
      {isMatched && currentStatus && proposedStatus && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: THEME.surfaceAlt,
          border: `1px solid ${THEME.border}`,
          borderRadius: 4,
          padding: '3px 8px',
          fontSize: 10,
          color: THEME.inkSoft,
          alignSelf: 'flex-start',
        }}>
          <span style={{ color: currentStatus.color }}>{currentStatus.label}</span>
          <span style={{ color: THEME.inkMuted }}>→</span>
          <span style={{ color: proposedStatus.color, fontWeight: 600 }}>{proposedStatus.label}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        {isMatched && (
          <button
            onClick={handleApprove}
            disabled={loading !== null}
            style={{ ...btnBase, background: THEME.accent, color: '#fff', flex: 1 }}
          >
            {loading === 'approve' ? 'Approving…' : 'Approve'}
          </button>
        )}
        {!isMatched && onViewEmail && (
          <button
            onClick={() => onViewEmail(item.raw_email)}
            disabled={loading !== null}
            style={{ ...btnBase, background: THEME.surfaceAlt, border: `1px solid ${THEME.border}`, color: THEME.ink }}
          >
            View full email
          </button>
        )}
        <button
          onClick={handleDismiss}
          disabled={loading !== null}
          style={{ ...btnBase, background: THEME.surfaceAlt, border: `1px solid ${THEME.border}`, color: THEME.inkSoft }}
        >
          {loading === 'dismiss' ? '…' : 'Dismiss'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 10, color: '#c44545', marginTop: 2 }}>{error}</div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { THEME } from '../../lib/theme';
import {
  fetchOrCreateInboxAddress,
  fetchInboxAddress,
  activateInbox,
  fetchPendingItems,
  approveProposal,
  dismissProposal,
} from '../../lib/inbox';
import { supabase } from '../../lib/supabase';
import { InboxSetup } from './InboxSetup';
import { ProposalCard } from './ProposalCard';
import type { InboxItem } from '../../types/track';

type Props = {
  userId: string;
  onClose: () => void;
  onPendingCountChange: (count: number) => void;
};

type InboxState = 'loading' | 'setup' | 'active';

export function InboxDrawer({ userId, onClose, onPendingCountChange }: Props) {
  const [state, setState] = useState<InboxState>('loading');
  const [address, setAddress] = useState('');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fullEmailItem, setFullEmailItem] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const pending = await fetchPendingItems(userId);
      setItems(pending);
      onPendingCountChange(pending.length);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [userId, onPendingCountChange]);

  useEffect(() => {
    async function init() {
      try {
        const addr = await fetchOrCreateInboxAddress(userId);
        setAddress(addr);
        const row = await fetchInboxAddress(userId);
        if (row?.activated_at) {
          setState('active');
          await loadItems();
        } else {
          setState('setup');
        }
      } catch (e) {
        setError((e as Error).message);
        setState('active');
      }
    }
    init();
  }, [userId, loadItems]);

  // Realtime subscription
  useEffect(() => {
    if (state !== 'active') return;
    const channel = supabase
      .channel('inbox-items')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'inbox_items',
        filter: `user_id=eq.${userId}`,
      }, () => {
        loadItems();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [state, userId, loadItems]);

  async function handleReady() {
    await activateInbox(userId);
    setState('active');
    await loadItems();
  }

  async function handleApprove(item: InboxItem) {
    await approveProposal(item);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    onPendingCountChange(items.length - 1);
  }

  async function handleDismiss(itemId: string) {
    await dismissProposal(itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    onPendingCountChange(items.length - 1);
  }

  return (
    <>
      {/* Dim */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(31,27,22,0.28)',
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420,
        background: THEME.surface,
        borderLeft: `1px solid ${THEME.border}`,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: THEME.sans,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 16px',
          borderBottom: `1px solid ${THEME.border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: THEME.ink }}>Inbox</span>
          {items.length > 0 && (
            <span style={{
              background: THEME.accent, color: '#fff',
              fontSize: 10, fontWeight: 700,
              padding: '1px 7px', borderRadius: 10,
              marginLeft: 8,
            }}>
              {items.length}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              fontSize: 18, color: THEME.inkMuted,
              cursor: 'pointer', lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        {state === 'loading' && (
          <div style={{ padding: 20, color: THEME.inkMuted, fontSize: 12 }}>Loading…</div>
        )}

        {state === 'setup' && (
          <InboxSetup address={address} onReady={handleReady} />
        )}

        {state === 'active' && !fullEmailItem && (
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {error && (
              <div style={{ fontSize: 11, color: '#c44545' }}>{error}</div>
            )}
            {items.length === 0 && !error && (
              <div style={{ fontSize: 12, color: THEME.inkMuted, marginTop: 16, textAlign: 'center', lineHeight: 1.7 }}>
                No proposals yet.<br />
                Pibox emails will appear here automatically.
              </div>
            )}
            {items.map((item) => (
              <ProposalCard
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onDismiss={handleDismiss}
                onViewEmail={(raw) => setFullEmailItem(raw)}
              />
            ))}
          </div>
        )}

        {state === 'active' && fullEmailItem && (
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setFullEmailItem(null)}
              style={{
                background: 'none', border: 'none',
                color: THEME.inkSoft, fontSize: 11,
                cursor: 'pointer', textAlign: 'left',
                padding: 0, fontFamily: THEME.sans,
              }}
            >
              ← Back to inbox
            </button>
            <pre style={{
              fontSize: 11, color: THEME.inkSoft,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              lineHeight: 1.6, margin: 0,
              background: THEME.surfaceAlt,
              border: `1px solid ${THEME.border}`,
              borderRadius: 4,
              padding: '10px 12px',
            }}>
              {fullEmailItem}
            </pre>
          </div>
        )}
      </div>
    </>
  );
}

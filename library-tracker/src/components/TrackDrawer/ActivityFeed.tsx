// src/components/TrackDrawer/ActivityFeed.tsx
import type { ReactNode } from 'react';
import { useTheme, statusById } from '../../lib/theme';
import type { ActivityEvent } from '../../types/track';

type Props = {
  events: ActivityEvent[];
};

function dotColor(event: ActivityEvent, THEME: ReturnType<typeof useTheme>): string {
  switch (event.kind) {
    case 'status_change':
      return statusById(event.to ?? '').color;
    case 'invoice_change':
      return '#c9a14a';
    case 'note':
      return THEME.accent;
    case 'email_matched':
      return '#5a7fb0';
    case 'created':
    default:
      return THEME.inkMuted;
  }
}

function describeEvent(event: ActivityEvent): ReactNode {
  switch (event.kind) {
    case 'status_change':
      return <>Status → <strong>{statusById(event.to ?? '').label}</strong></>;
    case 'invoice_change':
      return <>Invoice → <strong>{event.to}</strong></>;
    case 'note':
      return <em>"{event.detail}"</em>;
    case 'email_matched':
      return <>Email matched</>;
    case 'created':
    default:
      return <>Track created</>;
  }
}

function fmtEventTime(at: string): string {
  const d = new Date(at);
  if (isNaN(d.getTime())) return at;
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return 'today ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ActivityFeed({ events }: Props) {
  const THEME = useTheme();
  const sorted = [...events].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div style={{ fontSize: 12, color: THEME.inkMuted, fontFamily: THEME.sans, paddingTop: 4 }}>
        No activity yet.
      </div>
    );
  }

  return (
    <div>
      {sorted.map((event, i) => {
        const isLast = i === sorted.length - 1;
        return (
          <div key={`${event.at}-${event.kind}-${i}`} style={{ display: 'flex', gap: 9, marginBottom: 8, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: dotColor(event, THEME), flexShrink: 0,
              }} />
              {!isLast && (
                <div style={{
                  width: 1, background: THEME.border,
                  flex: 1, marginTop: 3, minHeight: 14,
                }} />
              )}
            </div>
            <div style={{ fontSize: 11.5, color: THEME.inkSoft, lineHeight: 1.45, fontFamily: THEME.sans }}>
              {describeEvent(event)}
              <span style={{ fontSize: 10, color: THEME.inkMuted, marginLeft: 5 }}>
                {fmtEventTime(event.at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

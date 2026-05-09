import { useTheme, fmtMoney } from '../lib/theme';
import type { Track } from '../types/track';

type Props = {
  tracks: Track[];
};

export function Footer({ tracks }: Props) {
  const THEME = useTheme();
  const active = tracks.filter(
    (t) => t.status !== 'delivered' && t.status !== 'rejected'
  ).length;

  const billed = tracks
    .filter((t) => t.invoice !== 'unpaid')
    .reduce((sum, t) => sum + (t.fee ?? 0), 0);

  const paid = tracks
    .filter((t) => t.invoice === 'paid')
    .reduce((sum, t) => sum + (t.fee ?? 0), 0);

  const outstanding = billed - paid;

  const stat = (label: string, value: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color: THEME.inkMuted }}>{label}</span>
      <span style={{ color: THEME.ink, fontWeight: 500 }}>{value}</span>
    </span>
  );

  return (
    <div style={{
      height: 36,
      padding: '0 22px',
      borderTop: `1px solid ${THEME.borderStrong}`,
      background: THEME.surface,
      display: 'flex', alignItems: 'center', gap: 20,
      fontSize: 11, fontFamily: THEME.mono,
      letterSpacing: 0.3,
      fontVariantNumeric: 'tabular-nums',
      flexShrink: 0,
    }}>
      {stat('Active', String(active))}
      <span style={{ color: THEME.border }}>·</span>
      {stat('Billed', fmtMoney(billed))}
      <span style={{ color: THEME.border }}>·</span>
      {stat('Paid', fmtMoney(paid))}
      <span style={{ color: THEME.border }}>·</span>
      {stat('Outstanding', fmtMoney(outstanding))}
    </div>
  );
}

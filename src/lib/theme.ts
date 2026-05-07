export const THEME = {
  bg:           '#f4f1ea',
  surface:      '#fbf9f4',
  surfaceAlt:   '#efeae0',
  border:       'rgba(40, 30, 20, 0.10)',
  borderStrong: 'rgba(40, 30, 20, 0.18)',
  ink:          '#1f1b16',
  inkSoft:      '#5a5249',
  inkMuted:     '#8a8276',
  accent:       '#b8593a',
  accentSoft:   'rgba(184, 89, 58, 0.12)',
  rowHover:     'rgba(40, 30, 20, 0.04)',
  rowActive:    'rgba(184, 89, 58, 0.08)',
  sans:         '"Inter Tight", -apple-system, BlinkMacSystemFont, sans-serif',
  mono:         '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
} as const;

export type Theme = typeof THEME;

export const STATUSES = [
  { id: 'brief',     label: 'Brief received', color: '#a89b8a' },
  { id: 'writing',   label: 'Writing',        color: '#c9a14a' },
  { id: 'written',   label: 'Written',        color: '#7c8a5c' },
  { id: 'revising',  label: 'Revising',       color: '#b06a3b' },
  { id: 'needs_rev', label: 'Needs revision', color: '#c44545' },
  { id: 'sent',      label: 'Demo sent',      color: '#5a7fb0' },
  { id: 'approved',  label: 'Approved',       color: '#3d8a5f' },
  { id: 'delivered', label: 'Delivered',      color: '#2c2a26' },
  { id: 'hold',      label: 'On hold',        color: '#8a8a8a' },
  { id: 'rejected',  label: 'Rejected',       color: '#6e3535' },
] as const;

export const INVOICE_STATES = [
  { id: 'unpaid',   label: 'Unpaid',   dot: '#c44545' },
  { id: 'invoiced', label: 'Invoiced', dot: '#c9a14a' },
  { id: 'paid',     label: 'Paid',     dot: '#3d8a5f' },
] as const;

export function statusById(id: string) {
  return STATUSES.find((s) => s.id === id) ?? STATUSES[0];
}

export function fmtMoney(n: number | null): string {
  if (n == null) return '—';
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

import { INVOICE_STATES, THEME } from '../../lib/theme';
import type { InvoiceStatus } from '../../types/track';

type Props = {
  value: InvoiceStatus;
  onCycle: (next: InvoiceStatus) => void;
};

const ORDER: InvoiceStatus[] = ['unpaid', 'invoiced', 'paid'];

export function InvoiceBadge({ value, onCycle }: Props) {
  const inv = INVOICE_STATES.find((x) => x.id === value) ?? INVOICE_STATES[0];

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const idx = ORDER.indexOf(value);
    const next = ORDER[(idx + 1) % ORDER.length];
    onCycle(next);
  }

  return (
    <button
      onClick={handleClick}
      title="Click to cycle invoice status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 9px',
        borderRadius: 4,
        background: 'transparent',
        border: `1px solid ${THEME.border}`,
        color: THEME.inkSoft,
        fontSize: 10.5,
        fontWeight: 500,
        fontFamily: THEME.sans,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        cursor: 'pointer',
      }}>
      <span style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: inv.dot,
        flexShrink: 0,
      }} />
      {inv.label}
    </button>
  );
}

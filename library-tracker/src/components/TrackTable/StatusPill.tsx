import { statusById, THEME } from '../../lib/theme';

type Props = {
  statusId: string;
};

export function StatusPill({ statusId }: Props) {
  const status = statusById(statusId);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      borderRadius: 999,
      background: THEME.surfaceAlt,
      border: `1px solid ${THEME.border}`,
      color: THEME.ink,
      fontSize: 11,
      fontWeight: 500,
      fontFamily: THEME.sans,
      whiteSpace: 'nowrap',
      letterSpacing: 0.1,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: status.color,
        flexShrink: 0,
      }} />
      {status.label}
    </span>
  );
}

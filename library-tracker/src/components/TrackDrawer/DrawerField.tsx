// src/components/TrackDrawer/DrawerField.tsx
import { useTheme } from '../../lib/theme';

type Props = {
  label: string;
  children: React.ReactNode;
  accessory?: React.ReactNode;
};

export function DrawerField({ label, children, accessory }: Props) {
  const THEME = useTheme();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 5,
      }}>
        <div style={{
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: THEME.inkMuted,
          fontFamily: THEME.sans,
        }}>
          {label}
        </div>
        {accessory ? <div>{accessory}</div> : null}
      </div>
      {children}
    </div>
  );
}

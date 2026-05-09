// src/components/TrackDrawer/DrawerField.tsx
import { useTheme } from '../../lib/theme';

type Props = {
  label: string;
  children: React.ReactNode;
};

export function DrawerField({ label, children }: Props) {
  const THEME = useTheme();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: THEME.inkMuted,
        marginBottom: 5,
        fontFamily: THEME.sans,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

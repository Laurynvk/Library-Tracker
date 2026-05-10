import { useState } from 'react';
import { useTheme } from '../lib/theme';

type Props = {
  value: string;
  title?: string;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
};

export function CopyIconButton({ value, title = 'Copy', size = 13, onClick }: Props) {
  const THEME = useTheme();
  const [copied, setCopied] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onClick?.(e);
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      title={title}
      onClick={handleClick}
      style={{
        flexShrink: 0,
        width: size + 5,
        height: size + 5,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: copied ? '#2e7d52' : THEME.inkMuted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 3,
        transition: 'color .12s',
      }}
    >
      {copied ? (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
          <polyline points="2,7 5.5,11 12,3" />
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="4" width="8" height="8" rx="1.5" />
          <path d="M2 10V3a1 1 0 011-1h7" />
        </svg>
      )}
    </button>
  );
}

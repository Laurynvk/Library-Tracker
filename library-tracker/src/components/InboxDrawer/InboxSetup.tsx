import { useState } from 'react';
import { THEME } from '../../lib/theme';

type Props = {
  address: string;
  onReady: () => void;
};

export function InboxSetup({ address, onReady }: Props) {
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const gmailFilterUrl =
    `https://mail.google.com/mail/u/0/#create-filter` +
    `?from=notifications%40pibox.com` +
    `&to=${encodeURIComponent(address)}`;

  const stepStyle: React.CSSProperties = {
    background: THEME.surfaceAlt,
    border: `1px solid ${THEME.border}`,
    borderRadius: 6,
    padding: '12px 14px',
  };

  const numberStyle: React.CSSProperties = {
    background: THEME.accent,
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: THEME.ink,
    marginBottom: 6,
  };

  return (
    <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', flex: 1 }}>
      <p style={{ fontSize: 12, color: THEME.inkSoft, lineHeight: 1.6, margin: 0 }}>
        When Pibox emails you about a track, Library Tracker can read it and propose a status update automatically.
      </p>

      {/* Step 1 */}
      <div style={stepStyle}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <div style={numberStyle}>1</div>
          <div style={labelStyle}>Copy your forwarding address</div>
        </div>
        <div style={{
          background: THEME.bg,
          border: `1px solid ${THEME.border}`,
          borderRadius: 4,
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 11, fontFamily: THEME.mono, color: THEME.accent, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {address}
          </span>
          <button
            onClick={copyAddress}
            style={{
              background: THEME.surfaceAlt,
              border: `1px solid ${THEME.border}`,
              borderRadius: 4,
              padding: '3px 10px',
              fontSize: 11,
              color: copied ? THEME.accent : THEME.inkSoft,
              cursor: 'pointer',
              fontFamily: THEME.sans,
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Step 2 */}
      <div style={stepStyle}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <div style={numberStyle}>2</div>
          <div style={labelStyle}>Set up a Gmail filter</div>
        </div>
        <p style={{ fontSize: 11, color: THEME.inkMuted, margin: '0 0 8px', lineHeight: 1.6 }}>
          In Gmail: Settings → Filters → Create new filter
        </p>
        <div style={{
          background: THEME.bg,
          border: `1px solid ${THEME.border}`,
          borderRadius: 4,
          padding: '8px 10px',
          fontSize: 11,
          lineHeight: 2,
          fontFamily: THEME.mono,
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ color: THEME.inkMuted, minWidth: 28 }}>From</span>
            <span style={{ color: THEME.ink }}>notifications@pibox.com</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ color: THEME.inkMuted, minWidth: 28 }}>To</span>
            <span style={{ color: THEME.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ color: THEME.inkMuted, minWidth: 28 }}>Do</span>
            <span style={{ color: THEME.ink }}>Forward to this address</span>
          </div>
        </div>
        <a
          href={gmailFilterUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 8,
            fontSize: 11,
            color: '#5a7fb0',
            textDecoration: 'none',
          }}
        >
          Open Gmail filters ↗
        </a>
      </div>

      {/* Step 3 */}
      <div style={stepStyle}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
          <div style={numberStyle}>3</div>
          <div style={labelStyle}>Done — that's it</div>
        </div>
        <p style={{ fontSize: 11, color: THEME.inkMuted, margin: 0, lineHeight: 1.6 }}>
          Next time Pibox emails you, it'll appear here as a proposal. You approve or dismiss — Library Tracker does the rest.
        </p>
      </div>

      <button
        onClick={onReady}
        style={{
          background: THEME.accent,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '10px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: THEME.sans,
          marginTop: 4,
        }}
      >
        I'm ready
      </button>
    </div>
  );
}

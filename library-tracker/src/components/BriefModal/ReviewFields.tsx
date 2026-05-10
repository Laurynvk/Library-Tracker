import { useTheme } from '../../lib/theme';
import type { ParsedBrief } from '../../lib/parseBrief';
import { CopyIconButton } from '../CopyIconButton';

export interface ReviewValues {
  code: string;
  version: string;
  album: string;
  publisher: string;
  due_date: string;
  fee: string;
  file_naming: string;
  title: string;
}

type Props = {
  parsed: ParsedBrief;
  values: ReviewValues;
  onChange: (patch: Partial<ReviewValues>) => void;
  onSkipTitle: () => void;
  fileNamingFromSettings?: boolean;
};

function wasExtracted(value: string, parsedValue: string | null): boolean {
  return !!parsedValue && value === parsedValue;
}

export function ReviewFields({ parsed, values, onChange, onSkipTitle, fileNamingFromSettings }: Props) {
  const THEME = useTheme();

  const fieldStyle: React.CSSProperties = {
    fontSize: 13, color: THEME.ink, background: '#fff',
    border: `1px solid ${THEME.border}`, borderRadius: 6,
    padding: '7px 10px', fontFamily: THEME.sans, outline: 'none', width: '100%',
  };

  const extractedStyle: React.CSSProperties = {
    ...fieldStyle,
    borderColor: '#b8d4b0', background: '#f4fbf3', color: '#2a6e22',
  };

  const settingsStyle: React.CSSProperties = {
    ...fieldStyle,
    borderColor: '#c4b8a8',
    background: '#f8f4ef',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Yellow approval banner */}
      <div style={{
        background: '#fffbea', border: '1px solid #f0d060',
        borderRadius: 8, padding: '10px 14px',
        fontSize: 12, color: '#7a5f00', lineHeight: 1.5,
      }}>
        <strong>Review before creating.</strong> Edit anything that looks wrong.
        Nothing is saved until you click <strong>Approve & Create Project</strong>.
      </div>

      {/* Fields grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label THEME={THEME}>Project Code</Label>
          <input
            style={wasExtracted(values.code, parsed.code) ? extractedStyle : fieldStyle}
            value={values.code}
            placeholder="Not found — add manually"
            onChange={(e) => onChange({ code: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label THEME={THEME}>Version</Label>
          <input
            style={fieldStyle}
            value={values.version}
            onChange={(e) => onChange({ version: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label THEME={THEME}>Album</Label>
          <input
            style={wasExtracted(values.album, parsed.album) ? extractedStyle : fieldStyle}
            value={values.album}
            placeholder="Not found — add manually"
            onChange={(e) => onChange({ album: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label THEME={THEME}>Publisher</Label>
          <input
            style={wasExtracted(values.publisher, parsed.publisher) ? extractedStyle : fieldStyle}
            value={values.publisher}
            placeholder="Not found — add manually"
            onChange={(e) => onChange({ publisher: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label THEME={THEME}>Due Date</Label>
          <input
            type="date"
            style={wasExtracted(values.due_date, parsed.due_date) ? extractedStyle : fieldStyle}
            value={values.due_date}
            onChange={(e) => onChange({ due_date: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label THEME={THEME}>Fee</Label>
          <input
            style={wasExtracted(values.fee, parsed.fee) ? extractedStyle : fieldStyle}
            value={values.fee}
            placeholder="e.g. £500"
            onChange={(e) => onChange({ fee: e.target.value })}
          />
        </div>

        {/* File naming — full width */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label THEME={THEME}>File Naming System</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            style={{
              ...(wasExtracted(values.file_naming, parsed.file_naming)
                ? extractedStyle
                : fileNamingFromSettings
                ? settingsStyle
                : fieldStyle),
              flex: 1,
            }}
            value={values.file_naming}
            placeholder="Not found in brief"
            onChange={(e) => onChange({ file_naming: e.target.value })}
          />
          {values.file_naming && (
            <CopyIconButton value={values.file_naming} title="Copy file naming system" size={13} />
          )}
          </div>
          {parsed.file_naming && (
            <span style={{ fontSize: 10, color: THEME.inkMuted }}>Found in brief — edit if needed</span>
          )}
          {!parsed.file_naming && fileNamingFromSettings && (
            <span style={{ fontSize: 10, color: THEME.inkMuted }}>From your settings — edit if needed</span>
          )}
        </div>
      </div>

      {/* Title prompt */}
      <div style={{
        background: THEME.surfaceAlt, borderRadius: 8, padding: '12px 14px',
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: THEME.inkSoft, marginBottom: 8 }}>
          Do you have a title for this track yet?
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...fieldStyle, flex: 1 }}
            value={values.title}
            placeholder="Enter title…"
            onChange={(e) => onChange({ title: e.target.value })}
          />
          <button
            onClick={onSkipTitle}
            style={{
              padding: '7px 12px', background: 'transparent', color: THEME.inkMuted,
              border: `1px solid ${THEME.border}`, borderRadius: 6, fontSize: 11.5,
              cursor: 'pointer', fontFamily: THEME.sans, whiteSpace: 'nowrap',
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children, THEME }: { children: React.ReactNode; THEME: ReturnType<typeof useTheme> }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, color: THEME.inkMuted,
      textTransform: 'uppercase', letterSpacing: '0.3px',
    }}>
      {children}
    </span>
  );
}

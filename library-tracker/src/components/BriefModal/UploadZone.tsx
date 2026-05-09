import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { THEME } from '../../lib/theme';

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

type Props = {
  onFile: (file: File) => void;
  onText: (text: string) => void;
};

export function UploadZone({ onFile, onText }: Props) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) onFile(accepted[0]);
  }, [onFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: false,
  });

  if (pasteMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          autoFocus
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste brief text here…"
          style={{
            width: '100%', minHeight: 120, padding: '10px 12px',
            fontSize: 13, fontFamily: THEME.sans, color: THEME.ink,
            background: '#fff', border: `1px solid ${THEME.border}`,
            borderRadius: 6, outline: 'none', resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { if (pasteText.trim()) onText(pasteText.trim()); }}
            disabled={!pasteText.trim()}
            style={{
              padding: '7px 16px', background: THEME.accent, color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
              cursor: pasteText.trim() ? 'pointer' : 'not-allowed', opacity: pasteText.trim() ? 1 : 0.5,
              fontFamily: THEME.sans,
            }}
          >
            Read Brief
          </button>
          <button
            onClick={() => setPasteMode(false)}
            style={{
              padding: '7px 14px', background: 'transparent', color: THEME.inkMuted,
              border: `1px solid ${THEME.border}`, borderRadius: 6, fontSize: 12.5,
              cursor: 'pointer', fontFamily: THEME.sans,
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? THEME.accent : THEME.borderStrong}`,
          borderRadius: 8, padding: '28px 20px', textAlign: 'center',
          background: isDragActive ? THEME.accentSoft : THEME.surfaceAlt,
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <input {...getInputProps()} />
        <div style={{ fontSize: 26, marginBottom: 8 }}>📄</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: THEME.ink, marginBottom: 4 }}>
          {isDragActive ? 'Drop it here…' : 'Drop your brief here, or click to browse'}
        </div>
        <div style={{ fontSize: 11.5, color: THEME.inkMuted }}>PDF · DOCX · TXT · PNG · JPG</div>
      </div>
      <button
        onClick={() => setPasteMode(true)}
        style={{
          background: 'transparent', border: 'none', color: THEME.inkMuted,
          fontSize: 12, cursor: 'pointer', fontFamily: THEME.sans,
          textDecoration: 'underline', textAlign: 'left', padding: 0,
        }}
      >
        Or paste text instead
      </button>
    </div>
  );
}

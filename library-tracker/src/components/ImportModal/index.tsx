import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTheme } from '../../lib/theme';
import {
  parseCSVText,
  applyFilter,
  parsedRowToNewTrack,
  type ParsedRow,
  type FilterType,
  type ImportFilter,
} from '../../lib/csvImport';
import { importTracks } from '../../lib/tracks';
import type { Track } from '../../types/track';

type Step = 'upload' | 'preview' | 'done';

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'initials', label: 'Initials' },
  { value: 'label',   label: 'Label' },
  { value: 'status',  label: 'Status' },
  { value: 'album',   label: 'Album' },
];

type Props = {
  onClose: () => void;
  onImported: (tracks: Track[]) => void;
};

export function ImportModal({ onClose, onImported }: Props) {
  const THEME = useTheme();
  const [step, setStep] = useState<Step>('upload');
  const [allRows, setAllRows] = useState<ParsedRow[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('initials');
  const [filterValue, setFilterValue] = useState('');
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const filter: ImportFilter = filterValue.trim()
    ? { type: filterType, value: filterValue }
    : null;

  const visibleRows = applyFilter(allRows, filter);

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, defaultedCount, detectedHeaders } = parseCSVText(text);
      setAllRows(rows);
      setWarningCount(defaultedCount);
      setDetectedHeaders(detectedHeaders);
      setStep('preview');
    };
    reader.onerror = () => setError('Failed to read file. Please try again.');
    reader.readAsText(file);
  }, []);

  const onDropRejected = useCallback((rejections: { file: File }[]) => {
    // Fallback: react-dropzone may reject a CSV whose browser MIME type
    // isn't recognised (Excel exports often report application/vnd.ms-excel
    // or empty string). If the file has a .csv extension, accept it anyway.
    const file = rejections[0]?.file;
    if (file && /\.csv$/i.test(file.name)) {
      onDrop([file]);
    } else if (file) {
      setError('Unsupported file type. Please upload a .csv file.');
    }
  }, [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
      'application/csv': ['.csv'],
      'text/plain': ['.csv'],
    },
    multiple: false,
  });

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const newTracks = visibleRows.map(parsedRowToNewTrack);
      const imported = await importTracks(newTracks);
      setImportedCount(imported.length);
      onImported(imported);
      setStep('done');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '5vh 16px', overflowY: 'auto',
  };

  const panel: React.CSSProperties = {
    width: '100%', maxWidth: 540,
    background: THEME.surface, borderRadius: 12,
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
    overflow: 'hidden', fontFamily: THEME.sans,
  };

  const header: React.CSSProperties = {
    padding: '18px 22px 14px', borderBottom: `1px solid ${THEME.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };

  const body: React.CSSProperties = {
    padding: '20px 22px',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px', background: THEME.accent, color: '#fff',
    border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
    cursor: importing ? 'not-allowed' : 'pointer',
    fontFamily: THEME.sans, opacity: importing ? 0.7 : 1,
  };

  const btnGhost: React.CSSProperties = {
    padding: '8px 16px', background: 'transparent', color: THEME.inkMuted,
    border: `1px solid ${THEME.border}`, borderRadius: 6,
    fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: THEME.sans,
  };

  return (
    <div style={overlay}>
      <div style={panel}>
        {/* Header */}
        <div style={header}>
          <span style={{ fontSize: 15, fontWeight: 700, color: THEME.ink, letterSpacing: -0.3 }}>
            {step === 'upload' && 'Import from spreadsheet'}
            {step === 'preview' && `${allRows.length} tracks found`}
            {step === 'done' && 'Import complete'}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: `1px solid ${THEME.border}`,
              background: 'transparent', cursor: 'pointer', fontSize: 16, color: THEME.inkMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={body}>

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div>
              <div
                {...getRootProps()}
                style={{
                  border: `2px dashed ${isDragActive ? THEME.accent : THEME.border}`,
                  borderRadius: 10, padding: '36px 24px',
                  textAlign: 'center', cursor: 'pointer',
                  background: isDragActive ? `${THEME.accent}0a` : THEME.surfaceAlt,
                  transition: 'all .15s',
                  marginBottom: 14,
                }}
              >
                <input {...getInputProps()} />
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: THEME.ink, marginBottom: 4 }}>
                  {isDragActive ? 'Drop it here' : 'Drop your CSV here'}
                </div>
                <div style={{ fontSize: 12, color: THEME.inkMuted, marginBottom: 14 }}>
                  Export from Google Sheets, Excel, or Numbers
                </div>
                <button style={{
                  ...btnPrimary, fontSize: 12, padding: '6px 16px',
                  background: THEME.accent, opacity: 1, cursor: 'pointer',
                }}>
                  Choose file
                </button>
              </div>
              <div style={{ fontSize: 11, color: THEME.inkMuted }}>
                Google Sheets → File → Download → Comma Separated Values (.csv)
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && (
            <div>
              {error && (
                <div style={{
                  background: '#fef0f0', border: '1px solid #f5b0b0',
                  borderRadius: 6, padding: '8px 12px',
                  fontSize: 12, color: '#c44545', marginBottom: 12,
                }}>
                  {error}
                </div>
              )}

              {allRows.length === 0 && detectedHeaders.length > 0 && (
                <div style={{
                  background: '#fef3c7', border: '1px solid #fbbf24',
                  borderRadius: 6, padding: '8px 12px',
                  fontSize: 12, color: '#78350f', marginBottom: 12,
                }}>
                  <strong>No title column found.</strong> Your CSV has these headers:{' '}
                  <code style={{ fontSize: 11 }}>{detectedHeaders.join(', ')}</code>
                  <br />
                  Expected one of: <code style={{ fontSize: 11 }}>Title, Track, Track Title, Name</code>
                </div>
              )}
              {allRows.length === 0 && detectedHeaders.length === 0 && (
                <div style={{
                  background: '#fef3c7', border: '1px solid #fbbf24',
                  borderRadius: 6, padding: '8px 12px',
                  fontSize: 12, color: '#78350f', marginBottom: 12,
                }}>
                  The file appears to be empty or could not be parsed.
                </div>
              )}

              {/* Count + Filter row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: THEME.inkMuted }}>
                  Showing <strong style={{ color: THEME.ink }}>{visibleRows.length}</strong> of {allRows.length}
                </span>

                {/* Compact filter control */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: THEME.inkMuted }}>Filter by</span>
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as FilterType)}
                      style={{
                        background: THEME.surfaceAlt,
                        border: `1px solid ${THEME.border}`,
                        borderRight: 'none',
                        borderRadius: '5px 0 0 5px',
                        padding: '4px 6px',
                        fontSize: 11,
                        color: THEME.ink,
                        cursor: 'pointer',
                        outline: 'none',
                        fontFamily: THEME.sans,
                      }}
                    >
                      {FILTER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      placeholder="type…"
                      style={{
                        background: THEME.surfaceAlt,
                        border: `1px solid ${THEME.border}`,
                        borderRadius: '0 5px 5px 0',
                        padding: '4px 8px',
                        fontSize: 11,
                        color: THEME.ink,
                        width: 60,
                        outline: 'none',
                        fontFamily: THEME.mono,
                        fontWeight: filterValue ? 700 : 400,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Preview table */}
              <div style={{
                border: `1px solid ${THEME.border}`, borderRadius: 8, overflow: 'hidden',
                marginBottom: 12,
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: THEME.surfaceAlt }}>
                      {['Title', 'Publisher', 'Status', 'Due Date'].map((h) => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '7px 10px',
                          fontSize: 10.5, fontWeight: 600, letterSpacing: 0.5,
                          textTransform: 'uppercase', color: THEME.inkMuted,
                          borderBottom: `1px solid ${THEME.border}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.slice(0, 5).map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                        <td style={{ padding: '7px 10px', color: THEME.ink, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</td>
                        <td style={{ padding: '7px 10px', color: THEME.inkSoft }}>{row.publisher ?? '—'}</td>
                        <td style={{ padding: '7px 10px', color: THEME.inkSoft }}>{row.status}</td>
                        <td style={{ padding: '7px 10px', color: THEME.inkSoft }}>{row.due_date ?? '—'}</td>
                      </tr>
                    ))}
                    {visibleRows.length > 5 && (
                      <tr>
                        <td colSpan={4} style={{
                          padding: '7px 10px', textAlign: 'center',
                          color: THEME.inkMuted, fontSize: 11, fontStyle: 'italic',
                        }}>
                          + {visibleRows.length - 5} more rows…
                        </td>
                      </tr>
                    )}
                    {visibleRows.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{
                          padding: '16px 10px', textAlign: 'center',
                          color: THEME.inkMuted, fontSize: 12,
                        }}>
                          No tracks match this filter
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {warningCount > 0 && (
                <div style={{
                  background: '#fffbeb', border: '1px solid #fcd34d',
                  borderRadius: 6, padding: '8px 12px',
                  fontSize: 12, color: '#92400e', marginBottom: 12,
                }}>
                  ⚠ {warningCount} tracks had unrecognised status values — they'll be imported as "briefed"
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={btnGhost} onClick={onClose}>Cancel</button>
                <button
                  style={btnPrimary}
                  disabled={importing || visibleRows.length === 0}
                  onClick={handleImport}
                >
                  {importing ? 'Importing…' : `Import ${visibleRows.length} track${visibleRows.length !== 1 ? 's' : ''} →`}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: THEME.ink, marginBottom: 6 }}>
                {importedCount} track{importedCount !== 1 ? 's' : ''} imported
              </div>
              <div style={{ fontSize: 13, color: THEME.inkMuted, marginBottom: 24 }}>
                You can update any statuses from the track table.
              </div>
              <button style={{ ...btnPrimary, cursor: 'pointer', opacity: 1 }} onClick={onClose}>
                Go to my tracks →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

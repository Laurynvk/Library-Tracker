// library-tracker/src/components/BriefModal/index.tsx
import { useState } from 'react';
import { useTheme } from '../../lib/theme';
import { parseBriefFile, parseBriefText, type ParsedBrief } from '../../lib/parseBrief';
import { createTrack } from '../../lib/tracks';
import {
  isFileSystemAccessSupported,
  createFoldersOnDesktop,
  createFoldersAsZip,
  type FolderSpec,
} from '../../lib/folderCreation';
import { fetchSettings } from '../../lib/settings';
import { UploadZone } from './UploadZone';
import { ReviewFields, type ReviewValues } from './ReviewFields';
import { FolderBuilder, DEFAULT_FOLDERS } from './FolderBuilder';
import type { Track } from '../../types/track';

type Step = 'upload' | 'reading' | 'review';

type Props = {
  onClose: () => void;
  onCreated: (track: Track) => void;
};

function parseFeeToNumber(raw: string): number | null {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'reading', label: 'Reading Brief' },
  { id: 'review', label: 'Review' },
];

export function BriefModal({ onClose, onCreated }: Props) {
  const THEME = useTheme();
  const [step, setStep] = useState<Step>('upload');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedBrief | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [values, setValues] = useState<ReviewValues>({
    code: '', version: 'v1.00', album: '', publisher: '',
    due_date: '', fee: '', file_naming: '', title: '',
  });
  const [folders, setFolders] = useState<string[]>(DEFAULT_FOLDERS);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileNamingFromSettings, setFileNamingFromSettings] = useState(false);

  async function handleFile(file: File) {
    setParseError(null);
    setLoadedFileName(file.name);
    setStep('reading');
    try {
      const result = await parseBriefFile(file);
      await applyParsed(result);
    } catch (e) {
      setParseError((e as Error).message);
      setStep('upload');
    }
  }

  async function handleText(text: string) {
    setParseError(null);
    setLoadedFileName(null);
    setStep('reading');
    try {
      const result = await parseBriefText(text);
      await applyParsed(result);
    } catch (e) {
      setParseError((e as Error).message);
      setStep('upload');
    }
  }

  async function applyParsed(result: ParsedBrief) {
    let fileNaming = (result.file_naming ?? '').replace(/-/g, '');
    let fromSettings = false;
    let defaultVersion = 'v1.00';

    try {
      const s = await fetchSettings();
      defaultVersion = s.default_version ?? 'v1.00';
      if (!fileNaming) {
        const t = s.naming_templates;
        const publisherKey = result.publisher;
        if (publisherKey && t.publishers?.[publisherKey]) {
          fileNaming = t.publishers[publisherKey];
          fromSettings = true;
        } else if (t.default) {
          fileNaming = t.default;
          fromSettings = true;
        }
      }
    } catch {
      // settings unavailable — use defaults
    }

    setParsed(result);
    setFileNamingFromSettings(fromSettings);
    setValues({
      code: result.code ?? '',
      version: defaultVersion,
      album: result.album ?? '',
      publisher: result.publisher ?? '',
      due_date: result.due_date ?? '',
      fee: result.fee ?? '',
      file_naming: fileNaming,
      title: '',
    });
    setStep('review');
  }

  function handleSkipTitle() {
    setValues((v) => ({ ...v, title: '' }));
  }

  async function handleApprove() {
    setSaving(true);
    try {
      // Create folders if user hasn't already done so via the builder buttons
      let resolvedPath = folderPath;
      if (!resolvedPath) {
        const spec: FolderSpec = {
          albumName: values.album || 'New Album',
          topLevelFolders: folders,
          trackTitle: values.title || null,
        };
        if (isFileSystemAccessSupported()) {
          resolvedPath = await createFoldersOnDesktop(spec);
        } else {
          await createFoldersAsZip(spec);
        }
      }

      const track = await createTrack({
        code: values.code || null,
        version: values.version || 'v1.00',
        album: values.album || null,
        publisher: values.publisher || null,
        publisher_email: null,
        due_date: values.due_date || null,
        fee: parseFeeToNumber(values.fee),
        file_naming: values.file_naming || null,
        title: values.title || '',
        status: 'brief',
        invoice: 'unpaid',
        brief_link: null,
        folder_path: resolvedPath,
        brief_parsed_at: new Date().toISOString(),
        collaborators: [],
        notes: null,
      });
      onCreated(track);
      onClose();
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // user cancelled folder picker
      alert('Failed to create project: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '5vh 16px', overflowY: 'auto',
    }}>
      <div style={{
        width: '100%', maxWidth: 560, background: THEME.surface,
        borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        overflow: 'hidden', fontFamily: THEME.sans,
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 22px 14px', borderBottom: `1px solid ${THEME.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: THEME.ink, letterSpacing: -0.3 }}>
            New Brief
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: `1px solid ${THEME.border}`,
              background: 'transparent', cursor: 'pointer', fontSize: 16, color: THEME.inkMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Step indicator */}
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          padding: '10px 24px', background: THEME.surfaceAlt,
          borderBottom: `1px solid ${THEME.border}`,
        }}>
          {/* connector line behind steps */}
          <div style={{ position: 'absolute', left: 24, right: 24, height: 1, background: THEME.border }} />
          {STEPS.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                background: THEME.surfaceAlt, padding: '0 6px',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: i < stepIndex ? '#2a6e22' : i === stepIndex ? THEME.accent : THEME.border,
                  color: i <= stepIndex ? '#fff' : THEME.inkMuted,
                }}>
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: i === stepIndex ? THEME.ink : THEME.inkMuted,
                }}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '70vh', overflowY: 'auto' }}>

          {step === 'upload' && (
            <>
              {parseError && (
                <div style={{
                  background: '#fef0f0', border: '1px solid #f5b0b0', borderRadius: 8,
                  padding: '10px 14px', fontSize: 12.5, color: '#c44545',
                }}>
                  Couldn't read this brief — {parseError}. Try a different file or paste the text instead.
                </div>
              )}
              <UploadZone onFile={handleFile} onText={handleText} />
            </>
          )}

          {step === 'reading' && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: THEME.inkMuted }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>📖</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: THEME.ink, marginBottom: 6 }}>
                Reading brief…
              </div>
              <div style={{ fontSize: 12, color: THEME.inkMuted }}>
                {loadedFileName ?? 'Extracting metadata'}
              </div>
            </div>
          )}

          {step === 'review' && parsed && (
            <>
              {loadedFileName && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#f0fdf0', border: '1px solid #b8d4b0',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2a6e22' }}>{loadedFileName}</div>
                    <div style={{ fontSize: 11, color: THEME.inkMuted, marginTop: 2 }}>Read successfully</div>
                  </div>
                  <button
                    onClick={() => { setStep('upload'); setLoadedFileName(null); setParsed(null); setParseError(null); }}
                    style={{
                      background: 'transparent', border: 'none', color: THEME.inkMuted,
                      fontSize: 11, cursor: 'pointer', fontFamily: THEME.sans,
                      textDecoration: 'underline', padding: 0,
                    }}
                  >
                    Replace
                  </button>
                </div>
              )}

              <ReviewFields
                parsed={parsed}
                values={values}
                onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
                onSkipTitle={handleSkipTitle}
                fileNamingFromSettings={fileNamingFromSettings}
              />

              <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 20 }}>
                <FolderBuilder
                  albumName={values.album}
                  trackTitle={values.title}
                  folders={folders}
                  onFoldersChange={setFolders}
                  onFolderPathSet={setFolderPath}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: `1px solid ${THEME.border}`,
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          background: THEME.surface,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', background: 'transparent', color: THEME.inkMuted,
              border: `1px solid ${THEME.border}`, borderRadius: 6,
              fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: THEME.sans,
            }}
          >
            Cancel
          </button>
          {step === 'review' && (
            <button
              onClick={handleApprove}
              disabled={saving}
              style={{
                padding: '8px 18px', background: THEME.accent, color: '#fff',
                border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: THEME.sans, opacity: saving ? 0.7 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {saving ? 'Creating…' : '✓ Approve & Create Project'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../lib/theme';
import {
  fetchSettings,
  fetchPublisherNames,
  saveSettings,
  type NamingTemplates,
} from '../../lib/settings';

type EditState = {
  default: string;
  publishers: Record<string, string>;
  initials: string;
  defaultVersion: string;
  darkMode: boolean;
};

type AddForm = { name: string; template: string } | null;

const TOKENS = ['{PROJECT}', '{ALBUM}', '{TITLE}', '{VERSION}', '{INITIALS}'];

const BASE_PREVIEW_VALUES: Record<string, string> = {
  '{PROJECT}': 'ProjectName',
  '{ALBUM}': 'AlbumName',
  '{TITLE}': 'TrackTitle',
  '{VERSION}': 'v1.00',
  '{INITIALS}': 'LL',
};

function renderPreview(template: string, previewValues: Record<string, string>): string {
  return Object.entries(previewValues).reduce(
    (s, [token, val]) => s.replaceAll(token, val),
    template,
  );
}

type Props = {
  onClose: () => void;
  onImportClick: () => void;
  onExport: () => void;
  onDarkModeChange: (dark: boolean) => void;
};

export function SettingsModal({ onClose, onImportClick, onExport, onDarkModeChange }: Props) {
  const THEME = useTheme();

  const fieldStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '6px 9px',
    background: THEME.surface,
    border: `1px solid ${THEME.border}`,
    borderRadius: 5,
    fontSize: 12,
    fontFamily: THEME.mono,
    color: THEME.ink,
    outline: 'none',
  };

  const [editState, setEditState] = useState<EditState>({
    default: '', publishers: {}, initials: '', defaultVersion: '', darkMode: false,
  });
  const [addForm, setAddForm] = useState<AddForm>(null);
  const [knownPublishers, setKnownPublishers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const focusedInputRef = useRef<HTMLInputElement | null>(null);
  const focusedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSettings(), fetchPublisherNames()])
      .then(([s, pubs]) => {
        setEditState({
          default: s.naming_templates.default ?? '',
          publishers: { ...(s.naming_templates.publishers ?? {}) },
          initials: s.initials ?? '',
          defaultVersion: s.default_version ?? '',
          darkMode: s.dark_mode ?? false,
        });
        setKnownPublishers(pubs);
      })
      .catch((e: unknown) => setLoadError((e as Error).message ?? 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const previewValues: Record<string, string> = {
    ...BASE_PREVIEW_VALUES,
    '{INITIALS}': editState.initials || 'LL',
  };

  function trackFocus(key: string, e: React.FocusEvent<HTMLInputElement>) {
    focusedInputRef.current = e.currentTarget;
    focusedKeyRef.current = key;
  }

  function insertToken(token: string) {
    const input = focusedInputRef.current;
    const key = focusedKeyRef.current;
    if (!input || key === null) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const newValue = input.value.slice(0, start) + token + input.value.slice(end);
    const newCursor = start + token.length;
    if (key === 'default') {
      setEditState((s) => ({ ...s, default: newValue }));
    } else if (key === '__add__') {
      setAddForm((f) => (f ? { ...f, template: newValue } : f));
    } else {
      setEditState((s) => ({ ...s, publishers: { ...s.publishers, [key]: newValue } }));
    }
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(newCursor, newCursor);
    });
  }

  function removePublisher(name: string) {
    setEditState((s) => {
      const next = { ...s.publishers };
      delete next[name];
      return { ...s, publishers: next };
    });
  }

  function commitAddForm() {
    if (!addForm || !addForm.name.trim()) return;
    setEditState((s) => ({
      ...s,
      publishers: { ...s.publishers, [addForm.name.trim()]: addForm.template },
    }));
    setAddForm(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const templates: NamingTemplates = {};
      if (editState.default) templates.default = editState.default;
      const nonEmptyPublishers = Object.fromEntries(
        Object.entries(editState.publishers).filter(([, t]) => t.trim()),
      );
      if (Object.keys(nonEmptyPublishers).length) templates.publishers = nonEmptyPublishers;
      await saveSettings({
        naming_templates: templates,
        initials: editState.initials || undefined,
        default_version: editState.defaultVersion || undefined,
        dark_mode: editState.darkMode || undefined,
      });
      onClose();
    } catch (e) {
      alert('Failed to save settings: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function TokenChips() {
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
        {TOKENS.map((t) => (
          <span
            key={t}
            onMouseDown={(e) => { e.preventDefault(); insertToken(t); }}
            style={{
              background: '#e8f5e9', border: '1px solid #a5d6a7',
              borderRadius: 3, padding: '2px 7px',
              fontSize: 10, fontFamily: THEME.mono, color: '#2a6e22',
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            {t}
          </span>
        ))}
        {[{ label: '_', value: '_' }, { label: '-', value: '-' }, { label: '·', value: ' ' }].map(({ label, value }) => (
          <span
            key={label}
            onMouseDown={(e) => { e.preventDefault(); insertToken(value); }}
            style={{
              background: '#e8f5e9', border: '1px solid #a5d6a7',
              borderRadius: 3, padding: '2px 7px',
              fontSize: 10, fontFamily: THEME.mono, color: '#2a6e22',
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            {label}
          </span>
        ))}
      </div>
    );
  }

  function PreviewLine({ template }: { template: string }) {
    if (!template) return null;
    return (
      <div style={{ marginTop: 6, fontSize: 10.5, color: THEME.inkMuted }}>
        Preview:{' '}
        <span style={{ fontFamily: THEME.mono, color: THEME.ink }}>
          {renderPreview(template, previewValues)}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '5vh 16px', overflowY: 'auto',
    }}>
      <div style={{
        width: '100%', maxWidth: 520, background: THEME.surface,
        borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        overflow: 'hidden', fontFamily: THEME.sans,
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 22px 14px', borderBottom: `1px solid ${THEME.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: THEME.ink, letterSpacing: -0.3 }}>
            Settings
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

        {/* Body */}
        <div style={{ padding: '20px 22px', maxHeight: '70vh', overflowY: 'auto' }}>

          {loadError && (
            <div style={{
              background: '#fef0f0', border: '1px solid #f5b0b0', borderRadius: 8,
              padding: '10px 14px', fontSize: 12.5, color: '#c44545', marginBottom: 12,
            }}>
              Failed to load settings: {loadError}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: THEME.inkMuted, fontSize: 13 }}>
              Loading…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ── Data ────────────────────────────────── */}
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                  textTransform: 'uppercase', color: THEME.inkMuted, marginBottom: 12,
                }}>
                  Data
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { onClose(); onImportClick(); }}
                    style={{
                      padding: '8px 14px',
                      background: THEME.surfaceAlt,
                      border: `1px solid ${THEME.border}`,
                      borderRadius: 6, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', color: THEME.ink, fontFamily: THEME.sans,
                    }}
                  >
                    ↑ Import CSV
                  </button>
                  <button
                    onClick={() => { onExport(); onClose(); }}
                    style={{
                      padding: '8px 14px',
                      background: THEME.surfaceAlt,
                      border: `1px solid ${THEME.border}`,
                      borderRadius: 6, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', color: THEME.ink, fontFamily: THEME.sans,
                    }}
                  >
                    ↓ Export CSV
                  </button>
                </div>
                <div style={{ fontSize: 11, color: THEME.inkMuted, marginTop: 8 }}>
                  Export downloads all your tracks as a .csv file you can open in any spreadsheet app.
                </div>
              </div>

              {/* ── General ─────────────────────────────── */}
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                  textTransform: 'uppercase', color: THEME.inkMuted, marginBottom: 12,
                }}>
                  General
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Initials */}
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: THEME.ink, display: 'block', marginBottom: 4 }}>
                      Your Initials
                    </label>
                    <input
                      style={{ ...fieldStyle, maxWidth: 100 }}
                      value={editState.initials}
                      placeholder="e.g. LL"
                      maxLength={8}
                      onChange={(e) => setEditState((s) => ({ ...s, initials: e.target.value }))}
                    />
                    <div style={{ fontSize: 10.5, color: THEME.inkMuted, marginTop: 4 }}>
                      Used as <span style={{ fontFamily: THEME.mono }}>{'{INITIALS}'}</span> in file naming templates
                    </div>
                  </div>

                  {/* Default Version */}
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: THEME.ink, display: 'block', marginBottom: 4 }}>
                      Default Version
                    </label>
                    <input
                      style={{ ...fieldStyle, maxWidth: 120 }}
                      value={editState.defaultVersion}
                      placeholder="v1.00"
                      onChange={(e) => setEditState((s) => ({ ...s, defaultVersion: e.target.value }))}
                    />
                    <div style={{ fontSize: 10.5, color: THEME.inkMuted, marginTop: 4 }}>
                      Starting version when you create a new brief
                    </div>
                  </div>

                  {/* Dark Mode */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: THEME.ink }}>
                      Dark Mode
                    </label>
                    <div
                      onClick={() => {
                        const next = !editState.darkMode;
                        setEditState((s) => ({ ...s, darkMode: next }));
                        onDarkModeChange(next);
                      }}
                      style={{
                        width: 40, height: 22, borderRadius: 11,
                        background: editState.darkMode ? THEME.accent : THEME.border,
                        position: 'relative', cursor: 'pointer',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: 3, left: editState.darkMode ? 21 : 3,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        transition: 'left 0.2s',
                      }} />
                    </div>
                  </div>

                </div>
              </div>

              {/* ── File Naming Templates ────────────────── */}
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                  textTransform: 'uppercase', color: THEME.inkMuted, marginBottom: 12,
                }}>
                  File Naming Templates
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Default card */}
                  <div style={{
                    background: '#f4fbf3', border: '1px solid #b8d4b0',
                    borderRadius: 8, padding: '12px 14px',
                  }}>
                    <div style={{
                      fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
                      textTransform: 'uppercase', color: '#2a6e22', marginBottom: 8,
                    }}>
                      Your Default
                    </div>
                    <input
                      style={{ ...fieldStyle, borderColor: '#b8d4b0', background: '#fff' }}
                      value={editState.default}
                      placeholder="e.g. {PROJECT} {ALBUM} {TITLE} {VERSION}"
                      onChange={(e) => setEditState((s) => ({ ...s, default: e.target.value }))}
                      onFocus={(e) => trackFocus('default', e)}
                    />
                    {TokenChips()}
                    {PreviewLine({ template: editState.default })}
                  </div>

                  {/* Per-publisher cards */}
                  {Object.entries(editState.publishers).map(([name, template]) => (
                    <div key={name} style={{
                      background: THEME.surfaceAlt, border: `1px solid ${THEME.border}`,
                      borderRadius: 8, padding: '12px 14px',
                    }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 8,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: THEME.ink }}>{name}</span>
                        <button
                          onClick={() => removePublisher(name)}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            fontSize: 11, color: THEME.inkMuted, padding: 0, fontFamily: THEME.sans,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        style={fieldStyle}
                        value={template}
                        placeholder="e.g. {PROJECT} {TITLE} {VERSION}"
                        onChange={(e) =>
                          setEditState((s) => ({
                            ...s,
                            publishers: { ...s.publishers, [name]: e.target.value },
                          }))
                        }
                        onFocus={(e) => trackFocus(name, e)}
                      />
                      {TokenChips()}
                      {PreviewLine({ template })}
                    </div>
                  ))}

                  {/* Add publisher */}
                  {addForm === null ? (
                    <button
                      onClick={() => setAddForm({ name: '', template: '' })}
                      style={{
                        background: 'transparent', border: `1px dashed ${THEME.border}`,
                        borderRadius: 8, padding: '10px 14px',
                        fontSize: 12, color: THEME.inkMuted, cursor: 'pointer',
                        fontFamily: THEME.sans, textAlign: 'left', width: '100%',
                      }}
                    >
                      + Add publisher…
                    </button>
                  ) : (
                    <div style={{
                      background: THEME.surfaceAlt, border: `1px solid ${THEME.border}`,
                      borderRadius: 8, padding: '12px 14px',
                    }}>
                      <div style={{
                        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
                        textTransform: 'uppercase', color: THEME.inkMuted, marginBottom: 8,
                      }}>
                        New Publisher
                      </div>
                      <datalist id="known-publishers">
                        {knownPublishers.map((p) => <option key={p} value={p} />)}
                      </datalist>
                      <input
                        list="known-publishers"
                        style={{ ...fieldStyle, marginBottom: 8 }}
                        value={addForm.name}
                        placeholder="Publisher name…"
                        onChange={(e) => setAddForm((f) => f ? { ...f, name: e.target.value } : f)}
                      />
                      <input
                        style={fieldStyle}
                        value={addForm.template}
                        placeholder="e.g. {PROJECT} {TITLE} {VERSION}"
                        onChange={(e) => setAddForm((f) => f ? { ...f, template: e.target.value } : f)}
                        onFocus={(e) => trackFocus('__add__', e)}
                      />
                      {TokenChips()}
                      {PreviewLine({ template: addForm.template })}
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button
                          onClick={commitAddForm}
                          disabled={!addForm.name.trim()}
                          style={{
                            padding: '6px 14px', background: THEME.accent, color: '#fff',
                            border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600,
                            cursor: addForm.name.trim() ? 'pointer' : 'not-allowed',
                            fontFamily: THEME.sans, opacity: addForm.name.trim() ? 1 : 0.5,
                          }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setAddForm(null)}
                          style={{
                            padding: '6px 14px', background: 'transparent', color: THEME.inkMuted,
                            border: `1px solid ${THEME.border}`, borderRadius: 5,
                            fontSize: 12, cursor: 'pointer', fontFamily: THEME.sans,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
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
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 18px', background: THEME.accent, color: '#fff',
              border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: THEME.sans, opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

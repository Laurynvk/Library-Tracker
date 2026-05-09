# Expanded Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Initials, Default Version String, and Dark Mode to the existing Settings modal, persisted in Supabase and applied app-wide.

**Architecture:** A `preferences` JSONB column is added to `user_settings` alongside the existing `naming_templates` column. The TypeScript layer merges both into a flat `UserSettings` type. Dark mode is driven by a `ThemeContext` React context — `App.tsx` provides the theme object based on a `darkMode` state boolean, and every component swaps its `import { THEME }` for `const THEME = useTheme()`. Initials update the live preview in SettingsModal; default_version replaces the hardcoded `'v1.00'` in BriefModal.

**Tech Stack:** React 18, TypeScript, Supabase JS client, Vite — no test framework (TypeScript compilation is the verification step).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260508200000_add_preferences_column.sql` | Create | Add `preferences JSONB` column to `user_settings` |
| `library-tracker/src/lib/settings.ts` | Modify | Extend `UserSettings` type; update `fetchSettings`/`saveSettings` to read/write `preferences` |
| `library-tracker/src/lib/theme.ts` | Modify | Add `DARK_THEME`, `ThemeContext`, `useTheme()` |
| `library-tracker/src/components/SettingsModal/index.tsx` | Modify | Add General section (initials, default version, dark mode toggle); update save; live initials in preview |
| `library-tracker/src/App.tsx` | Modify | Load `dark_mode` from settings; add `darkMode` state; wrap render in `ThemeContext.Provider` |
| `library-tracker/src/components/Toolbar/index.tsx` | Modify | `useTheme()` |
| `library-tracker/src/components/TrackTable/index.tsx` | Modify | `useTheme()` |
| `library-tracker/src/components/TrackDrawer/index.tsx` | Modify | `useTheme()` |
| `library-tracker/src/components/TrackDrawer/DrawerField.tsx` | Modify | `useTheme()` |
| `library-tracker/src/components/TrackDrawer/ActivityFeed.tsx` | Modify | `useTheme()` |
| `library-tracker/src/components/Footer.tsx` | Modify | `useTheme()` |
| `library-tracker/src/components/BriefModal/index.tsx` | Modify | `useTheme()` + use `default_version` from settings |
| `library-tracker/src/components/BriefModal/ReviewFields.tsx` | Modify | `useTheme()` |
| `library-tracker/src/components/BriefModal/UploadZone.tsx` | Modify | `useTheme()` |
| `library-tracker/src/components/BriefModal/FolderBuilder.tsx` | Modify | `useTheme()` |
| `library-tracker/src/components/InboxDrawer/index.tsx` | Modify | `useTheme()` |
| `library-tracker/src/components/InboxDrawer/ProposalCard.tsx` | Modify | `useTheme()` |
| `library-tracker/src/components/InboxDrawer/InboxSetup.tsx` | Modify | `useTheme()` |

---

## Task 1: DB Migration + Settings Type Extension

**Files:**
- Create: `supabase/migrations/20260508200000_add_preferences_column.sql`
- Modify: `library-tracker/src/lib/settings.ts`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260508200000_add_preferences_column.sql
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';
```

- [ ] **Step 2: Apply the migration in Supabase**

Run in the Supabase SQL editor (dashboard → SQL editor):
```sql
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';
```

Expected: query succeeds with no error. Verify by selecting from `user_settings` and confirming a `preferences` column exists.

- [ ] **Step 3: Replace the contents of `library-tracker/src/lib/settings.ts`**

```ts
import { supabase } from './supabase';

const USER_ID = '4daf3a38-2ab6-42f4-82f1-de5a2483794d';

export type NamingTemplates = {
  default?: string;
  publishers?: Record<string, string>;
};

export type Preferences = {
  initials?: string;
  default_version?: string;
  dark_mode?: boolean;
};

export type UserSettings = {
  naming_templates: NamingTemplates;
  initials?: string;
  default_version?: string;
  dark_mode?: boolean;
};

let cache: UserSettings | null = null;

export async function fetchSettings(): Promise<UserSettings> {
  if (cache) return cache;
  const { data, error } = await supabase
    .from('user_settings')
    .select('naming_templates, preferences')
    .eq('user_id', USER_ID)
    .maybeSingle();
  if (error) throw error;
  const prefs = (data?.preferences ?? {}) as Preferences;
  cache = data
    ? {
        naming_templates: data.naming_templates as NamingTemplates,
        ...prefs,
      }
    : { naming_templates: {} };
  return cache;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const { naming_templates, initials, default_version, dark_mode } = settings;
  const preferences: Preferences = {};
  if (initials !== undefined) preferences.initials = initials;
  if (default_version !== undefined) preferences.default_version = default_version;
  if (dark_mode !== undefined) preferences.dark_mode = dark_mode;

  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: USER_ID, naming_templates, preferences });
  if (error) throw error;
  cache = settings;
}

export async function fetchPublisherNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from('tracks')
    .select('publisher')
    .not('publisher', 'is', null);
  if (error) throw error;
  const names = (data as { publisher: string }[]).map((r) => r.publisher);
  return [...new Set(names)].sort();
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260508200000_add_preferences_column.sql library-tracker/src/lib/settings.ts
git commit -m "feat: extend user_settings with preferences column (initials, default_version, dark_mode)"
```

---

## Task 2: Add DARK_THEME, ThemeContext, and useTheme() to theme.ts

**Files:**
- Modify: `library-tracker/src/lib/theme.ts`

- [ ] **Step 1: Replace the contents of `library-tracker/src/lib/theme.ts`**

`Theme` must be an explicit interface (not `typeof THEME`) so both `THEME` and `DARK_THEME` satisfy it — `as const` would give each object different literal types, making them incompatible with the context.

```ts
import { createContext, useContext } from 'react';

export type Theme = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  accent: string;
  accentSoft: string;
  rowHover: string;
  rowActive: string;
  sans: string;
  mono: string;
};

export const THEME: Theme = {
  bg:           '#f4f1ea',
  surface:      '#fbf9f4',
  surfaceAlt:   '#efeae0',
  border:       'rgba(40, 30, 20, 0.10)',
  borderStrong: 'rgba(40, 30, 20, 0.18)',
  ink:          '#1f1b16',
  inkSoft:      '#5a5249',
  inkMuted:     '#8a8276',
  accent:       '#b8593a',
  accentSoft:   'rgba(184, 89, 58, 0.12)',
  rowHover:     'rgba(40, 30, 20, 0.04)',
  rowActive:    'rgba(184, 89, 58, 0.08)',
  sans:         '"Inter Tight", -apple-system, BlinkMacSystemFont, sans-serif',
  mono:         '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
};

export const DARK_THEME: Theme = {
  bg:           '#1a1714',
  surface:      '#232018',
  surfaceAlt:   '#2c2820',
  border:       'rgba(255, 245, 230, 0.10)',
  borderStrong: 'rgba(255, 245, 230, 0.18)',
  ink:          '#f0ebe3',
  inkSoft:      '#b8b0a4',
  inkMuted:     '#7a7268',
  accent:       '#d4704a',
  accentSoft:   'rgba(212, 112, 74, 0.15)',
  rowHover:     'rgba(255, 245, 230, 0.04)',
  rowActive:    'rgba(212, 112, 74, 0.10)',
  sans:         '"Inter Tight", -apple-system, BlinkMacSystemFont, sans-serif',
  mono:         '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
};

export const ThemeContext = createContext<Theme>(THEME);
export function useTheme(): Theme { return useContext(ThemeContext); }

export const STATUSES = [
  { id: 'brief',     label: 'Brief received', color: '#a89b8a' },
  { id: 'writing',   label: 'Writing',        color: '#c9a14a' },
  { id: 'written',   label: 'Written',        color: '#7c8a5c' },
  { id: 'revising',  label: 'Revising',       color: '#b06a3b' },
  { id: 'needs_rev', label: 'Needs revision', color: '#c44545' },
  { id: 'sent',      label: 'Demo sent',      color: '#5a7fb0' },
  { id: 'approved',  label: 'Approved',       color: '#3d8a5f' },
  { id: 'delivered', label: 'Delivered',      color: '#2c2a26' },
  { id: 'hold',      label: 'On hold',        color: '#8a8a8a' },
  { id: 'rejected',  label: 'Rejected',       color: '#6e3535' },
] as const;

export const INVOICE_STATES = [
  { id: 'unpaid',   label: 'Unpaid',   dot: '#c44545' },
  { id: 'invoiced', label: 'Invoiced', dot: '#c9a14a' },
  { id: 'paid',     label: 'Paid',     dot: '#3d8a5f' },
] as const;

export function statusById(id: string) {
  return STATUSES.find((s) => s.id === id) ?? STATUSES[0];
}

export function fmtMoney(n: number | null): string {
  if (n == null) return '—';
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors (THEME still exists as a named export, so existing consumers aren't broken yet).

- [ ] **Step 3: Commit**

```bash
git add library-tracker/src/lib/theme.ts
git commit -m "feat: add DARK_THEME, ThemeContext, and useTheme() hook to theme.ts"
```

---

## Task 3: Add General Section to SettingsModal

**Files:**
- Modify: `library-tracker/src/components/SettingsModal/index.tsx`

This task adds the "General" section (Initials, Default Version, Dark Mode) above the existing "File Naming Templates" section and updates save/load to handle the three new fields. It also makes the `{INITIALS}` preview use the live value from the Initials input.

- [ ] **Step 1: Replace the contents of `library-tracker/src/components/SettingsModal/index.tsx`**

```tsx
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
};

export function SettingsModal({ onClose }: Props) {
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      id="dark-mode-toggle"
                      type="checkbox"
                      checked={editState.darkMode}
                      onChange={(e) => setEditState((s) => ({ ...s, darkMode: e.target.checked }))}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label
                      htmlFor="dark-mode-toggle"
                      style={{ fontSize: 11.5, fontWeight: 600, color: THEME.ink, cursor: 'pointer' }}
                    >
                      Dark Mode
                    </label>
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
                      placeholder="e.g. {PROJECT}_{ALBUM}_{TITLE}_{VERSION}"
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
                        placeholder="e.g. {PROJECT}_{TITLE}_{VERSION}"
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
                        placeholder="e.g. {PROJECT}_{TITLE}_{VERSION}"
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add library-tracker/src/components/SettingsModal/index.tsx
git commit -m "feat: add General section to SettingsModal (initials, default version, dark mode)"
```

---

## Task 4: Wire ThemeContext in App.tsx

**Files:**
- Modify: `library-tracker/src/App.tsx`

App cannot use `useTheme()` to read its own context — it *provides* the context. Instead it computes the theme directly from its `darkMode` state.

- [ ] **Step 1: Replace the contents of `library-tracker/src/App.tsx`**

```tsx
import { useEffect, useState, useMemo } from 'react';
import { fetchTracks, updateTrack } from './lib/tracks';
import { Toolbar } from './components/Toolbar';
import { TrackTable } from './components/TrackTable';
import { Footer } from './components/Footer';
import { TrackDrawer } from './components/TrackDrawer';
import { InboxDrawer } from './components/InboxDrawer';
import { BriefModal } from './components/BriefModal';
import { SettingsModal } from './components/SettingsModal';
import { THEME, DARK_THEME, ThemeContext } from './lib/theme';
import { fetchSettings } from './lib/settings';
import type { Track, InvoiceStatus } from './types/track';

function bumpVersion(v: string): string {
  const match = v.match(/^v(\d+)\.(\d+)$/);
  if (!match) return v;
  const minor = parseInt(match[2], 10) + 1;
  return `v${match[1]}.${String(minor).padStart(2, '0')}`;
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterInvoice, setFilterInvoice] = useState('all');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxPendingCount, setInboxPendingCount] = useState(0);
  const [briefOpen, setBriefOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    fetchTracks()
      .then(setTracks)
      .catch((e) => setError(e.message));
    fetchSettings()
      .then((s) => setDarkMode(s.dark_mode ?? false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      fetchSettings()
        .then((s) => setDarkMode(s.dark_mode ?? false))
        .catch(() => {});
    }
  }, [settingsOpen]);

  const theme = darkMode ? DARK_THEME : THEME;

  const filtered = useMemo(() => {
    let list = [...tracks];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        `${t.code ?? ''} ${t.title} ${t.publisher ?? ''}`.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') list = list.filter((t) => t.status === filterStatus);
    if (filterInvoice !== 'all') list = list.filter((t) => t.invoice === filterInvoice);
    return list;
  }, [tracks, search, filterStatus, filterInvoice]);

  function handleSelectTrack(track: Track) {
    setSelectedTrack(track);
  }

  function handleSaveTrack(updated: Track) {
    setTracks((prev) => prev.map((t) => {
      if (t.id !== updated.id) return t;
      if (updated.status === 'revising' && t.status !== 'revising') {
        const newVersion = bumpVersion(updated.version || 'v1.00');
        updateTrack(updated.id, { version: newVersion }).catch((e) => setError(e.message));
        return { ...updated, version: newVersion };
      }
      return updated;
    }));
    setSelectedTrack((prev) => {
      if (prev?.id !== updated.id) return prev;
      if (updated.status === 'revising') {
        const existing = tracks.find((t) => t.id === updated.id);
        if (existing && existing.status !== 'revising') {
          return { ...updated, version: bumpVersion(updated.version || 'v1.00') };
        }
      }
      return updated;
    });
  }

  async function handleUpdateInvoice(id: string, invoice: InvoiceStatus) {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, invoice } : t))
    );
    try {
      await updateTrack(id, { invoice });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleUpdateTitle(id: string, title: string) {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    setSelectedTrack((prev) => (prev?.id === id ? { ...prev, title } : prev));
    try {
      await updateTrack(id, { title });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleUpdateCode(id: string, code: string | null) {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, code } : t)));
    setSelectedTrack((prev) => (prev?.id === id ? { ...prev, code } : prev));
    try {
      await updateTrack(id, { code });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleUpdateVersion(id: string, version: string) {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, version } : t)));
    setSelectedTrack((prev) => (prev?.id === id ? { ...prev, version } : prev));
    try {
      await updateTrack(id, { version });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleBriefCreated(track: Track) {
    setTracks((prev) => [track, ...prev]);
  }

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: theme.sans, color: '#c44545' }}>
        DB error: {error}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: theme.bg,
        fontFamily: theme.sans,
        overflow: 'hidden',
      }}>
        <Toolbar
          trackCount={tracks.length}
          search={search}
          onSearch={setSearch}
          filterStatus={filterStatus}
          onFilterStatus={setFilterStatus}
          filterInvoice={filterInvoice}
          onFilterInvoice={setFilterInvoice}
          inboxPendingCount={inboxPendingCount}
          onInboxOpen={() => setInboxOpen(true)}
          onNewFromBrief={() => setBriefOpen(true)}
          onSettingsOpen={() => setSettingsOpen(true)}
        />
        <TrackTable
          tracks={filtered}
          onUpdateInvoice={handleUpdateInvoice}
          onUpdateTitle={handleUpdateTitle}
          onUpdateVersion={handleUpdateVersion}
          onUpdateCode={handleUpdateCode}
          onRowClick={handleSelectTrack}
          selectedTrackId={selectedTrack?.id}
        />
        <Footer tracks={tracks} />
        <TrackDrawer
          key={selectedTrack?.id ?? 'none'}
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
          onSave={handleSaveTrack}
        />
        {inboxOpen && (
          <InboxDrawer
            userId="4daf3a38-2ab6-42f4-82f1-de5a2483794d"
            onClose={() => setInboxOpen(false)}
            onPendingCountChange={setInboxPendingCount}
          />
        )}
        {briefOpen && (
          <BriefModal
            onClose={() => setBriefOpen(false)}
            onCreated={handleBriefCreated}
          />
        )}
        {settingsOpen && (
          <SettingsModal onClose={() => setSettingsOpen(false)} />
        )}
      </div>
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add library-tracker/src/App.tsx
git commit -m "feat: wire ThemeContext provider in App.tsx, load dark_mode from settings"
```

---

## Task 5: Update All Remaining Components to Use useTheme()

**Files:**
- Modify: `library-tracker/src/components/Toolbar/index.tsx`
- Modify: `library-tracker/src/components/TrackTable/index.tsx`
- Modify: `library-tracker/src/components/TrackDrawer/index.tsx`
- Modify: `library-tracker/src/components/TrackDrawer/DrawerField.tsx`
- Modify: `library-tracker/src/components/TrackDrawer/ActivityFeed.tsx`
- Modify: `library-tracker/src/components/Footer.tsx`
- Modify: `library-tracker/src/components/BriefModal/ReviewFields.tsx`
- Modify: `library-tracker/src/components/BriefModal/UploadZone.tsx`
- Modify: `library-tracker/src/components/BriefModal/FolderBuilder.tsx`
- Modify: `library-tracker/src/components/InboxDrawer/index.tsx`
- Modify: `library-tracker/src/components/InboxDrawer/ProposalCard.tsx`
- Modify: `library-tracker/src/components/InboxDrawer/InboxSetup.tsx`

The pattern for each file is identical:

**Before (top of file):**
```ts
import { THEME } from '../../lib/theme';
// or
import { THEME, STATUSES, INVOICE_STATES } from '../../lib/theme';
// or
import { THEME, fmtMoney, fmtDate } from '../../lib/theme';
// or
import { THEME, statusById, fmtDate } from '../../lib/theme';
```

**After:**
```ts
import { useTheme, STATUSES, INVOICE_STATES } from '../../lib/theme';
// (keep any non-THEME named imports; drop THEME from the import list)
```

Then, inside the component function body (before any JSX), add:
```ts
const THEME = useTheme();
```

This preserves all existing `THEME.xxx` references without any further changes.

- [ ] **Step 1: Update `library-tracker/src/components/Toolbar/index.tsx`**

Change the import line from:
```ts
import { THEME, STATUSES, INVOICE_STATES } from '../../lib/theme';
```
to:
```ts
import { useTheme, STATUSES, INVOICE_STATES } from '../../lib/theme';
```

Then add as the first line inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 2: Update `library-tracker/src/components/TrackTable/index.tsx`**

Change the import line from:
```ts
import { THEME, fmtMoney, fmtDate } from '../../lib/theme';
```
to:
```ts
import { useTheme, fmtMoney, fmtDate } from '../../lib/theme';
```

Add inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 3: Update `library-tracker/src/components/TrackDrawer/index.tsx`**

Change the import line from:
```ts
import { THEME, STATUSES, INVOICE_STATES } from '../../lib/theme';
```
to:
```ts
import { useTheme, STATUSES, INVOICE_STATES } from '../../lib/theme';
```

Add inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 4: Update `library-tracker/src/components/TrackDrawer/DrawerField.tsx`**

Change the import line from:
```ts
import { THEME } from '../../lib/theme';
```
to:
```ts
import { useTheme } from '../../lib/theme';
```

Add inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 5: Update `library-tracker/src/components/TrackDrawer/ActivityFeed.tsx`**

Change the import line from:
```ts
import { THEME, statusById } from '../../lib/theme';
```
to:
```ts
import { useTheme, statusById } from '../../lib/theme';
```

Add inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 6: Update `library-tracker/src/components/Footer.tsx`**

Change the import line from:
```ts
import { THEME, fmtMoney } from '../lib/theme';
```
to:
```ts
import { useTheme, fmtMoney } from '../lib/theme';
```

Add inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 7: Update `library-tracker/src/components/BriefModal/ReviewFields.tsx`**

Change the import line from:
```ts
import { THEME } from '../../lib/theme';
```
to:
```ts
import { useTheme } from '../../lib/theme';
```

Add inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 8: Update `library-tracker/src/components/BriefModal/UploadZone.tsx`**

Change the import line from:
```ts
import { THEME } from '../../lib/theme';
```
to:
```ts
import { useTheme } from '../../lib/theme';
```

Add inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 9: Update `library-tracker/src/components/BriefModal/FolderBuilder.tsx`**

Change the import line from:
```ts
import { THEME } from '../../lib/theme';
```
to:
```ts
import { useTheme } from '../../lib/theme';
```

Add inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 10: Update `library-tracker/src/components/InboxDrawer/index.tsx`**

Change the import line from:
```ts
import { THEME } from '../../lib/theme';
```
to:
```ts
import { useTheme } from '../../lib/theme';
```

Add inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 11: Update `library-tracker/src/components/InboxDrawer/ProposalCard.tsx`**

Change the import line from:
```ts
import { THEME, statusById, fmtDate } from '../../lib/theme';
```
to:
```ts
import { useTheme, statusById, fmtDate } from '../../lib/theme';
```

Add inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 12: Update `library-tracker/src/components/InboxDrawer/InboxSetup.tsx`**

Change the import line from:
```ts
import { THEME } from '../../lib/theme';
```
to:
```ts
import { useTheme } from '../../lib/theme';
```

Add inside the component function body:
```ts
const THEME = useTheme();
```

- [ ] **Step 13: Verify TypeScript compiles clean**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 14: Commit**

```bash
git add \
  library-tracker/src/components/Toolbar/index.tsx \
  library-tracker/src/components/TrackTable/index.tsx \
  library-tracker/src/components/TrackDrawer/index.tsx \
  library-tracker/src/components/TrackDrawer/DrawerField.tsx \
  library-tracker/src/components/TrackDrawer/ActivityFeed.tsx \
  library-tracker/src/components/Footer.tsx \
  library-tracker/src/components/BriefModal/ReviewFields.tsx \
  library-tracker/src/components/BriefModal/UploadZone.tsx \
  library-tracker/src/components/BriefModal/FolderBuilder.tsx \
  library-tracker/src/components/InboxDrawer/index.tsx \
  library-tracker/src/components/InboxDrawer/ProposalCard.tsx \
  library-tracker/src/components/InboxDrawer/InboxSetup.tsx
git commit -m "feat: update all components to use useTheme() hook"
```

---

## Task 6: Use default_version from Settings in BriefModal

**Files:**
- Modify: `library-tracker/src/components/BriefModal/index.tsx`

Currently `applyParsed` sets `version: 'v1.00'` unconditionally. This task reads `default_version` from settings (which is already fetched in `applyParsed` when the file naming fallback runs). The settings fetch is cheap due to caching — we always call it.

- [ ] **Step 1: Update the import line at the top of `library-tracker/src/components/BriefModal/index.tsx`**

Change:
```ts
import { THEME } from '../../lib/theme';
```
to:
```ts
import { useTheme } from '../../lib/theme';
```

- [ ] **Step 2: Add `const THEME = useTheme();` inside `BriefModal` component function body**

Add it as the first line inside the `BriefModal` function body (before the `useState` calls).

- [ ] **Step 3: Update `applyParsed` to always fetch settings and use `default_version`**

Replace the existing `applyParsed` function:

```ts
async function applyParsed(result: ParsedBrief) {
  let fileNaming = result.file_naming ?? '';
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
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add library-tracker/src/components/BriefModal/index.tsx
git commit -m "feat: use default_version from settings in BriefModal, hook into ThemeContext"
```

---

## Final Verification

- [ ] **Build the app and check for errors**

```bash
cd library-tracker && npm run build
```

Expected: clean build, no TypeScript or Vite errors.

- [ ] **Manual smoke test (open the app in browser)**

1. Open the app (Vercel deploy or `npm run dev`)
2. Open Settings (gear icon)
3. Confirm "General" section is visible with Initials, Default Version, and Dark Mode controls
4. Enter initials (e.g. "AB") and confirm the `{INITIALS}` preview in File Naming Templates updates
5. Check the Dark Mode toggle — Save — confirm the entire UI switches to dark colors
6. Set a Default Version (e.g. "v2.00") — Save — open "New Brief", paste text, advance to Review — confirm the version field shows "v2.00"
7. Toggle dark mode back off — Save — confirm light mode is restored

- [ ] **Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: expanded settings final cleanup"
```

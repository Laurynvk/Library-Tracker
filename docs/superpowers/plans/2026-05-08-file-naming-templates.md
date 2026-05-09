# File Naming Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings overlay where users configure per-publisher and default file naming templates, which auto-fill the Brief review step when a brief omits naming instructions.

**Architecture:** A new `user_settings` Supabase table holds naming templates as JSONB (keyed by publisher name, plus a default). `lib/settings.ts` wraps fetching/saving with an in-memory cache. The SettingsModal is a new centered overlay opened via a gear icon in the Toolbar. The BriefModal's `applyParsed` function consults settings when the brief has no file naming.

**Tech Stack:** React, TypeScript, Supabase JS client, Vite (no test framework — verify via browser)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260508100000_add_user_settings.sql` | Create | New table migration |
| `library-tracker/src/lib/settings.ts` | Create | Fetch/save settings, publisher name suggestions |
| `library-tracker/src/components/SettingsModal/index.tsx` | Create | Full settings overlay component |
| `library-tracker/src/components/Toolbar/index.tsx` | Modify | Add gear icon + `onSettingsOpen` prop |
| `library-tracker/src/App.tsx` | Modify | Wire `settingsOpen` state + render SettingsModal |
| `library-tracker/src/components/BriefModal/index.tsx` | Modify | Fallback logic in `applyParsed` |
| `library-tracker/src/components/BriefModal/ReviewFields.tsx` | Modify | `fileNamingFromSettings` prop + neutral-tint style |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260508100000_add_user_settings.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260508100000_add_user_settings.sql
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  naming_templates JSONB NOT NULL DEFAULT '{}'
);
```

Note: No auth FK or RLS — the app is single-user with a hardcoded user ID.

- [ ] **Step 2: Apply the migration**

```bash
cd /Users/laurynvk/Documents/ClaudeProjects/LibraryTracker
supabase db push
```

Expected: migration applies cleanly, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508100000_add_user_settings.sql
git commit -m "feat: add user_settings table for naming templates"
```

---

## Task 2: Settings Data Layer

**Files:**
- Create: `library-tracker/src/lib/settings.ts`

- [ ] **Step 1: Create `lib/settings.ts`**

```ts
import { supabase } from './supabase';

const USER_ID = '4daf3a38-2ab6-42f4-82f1-de5a2483794d';

export type NamingTemplates = {
  default?: string;
  publishers?: Record<string, string>;
};

export type UserSettings = {
  naming_templates: NamingTemplates;
};

let cache: UserSettings | null = null;

export async function fetchSettings(): Promise<UserSettings> {
  if (cache) return cache;
  const { data, error } = await supabase
    .from('user_settings')
    .select('naming_templates')
    .eq('user_id', USER_ID)
    .maybeSingle();
  if (error) throw error;
  cache = data
    ? { naming_templates: data.naming_templates as NamingTemplates }
    : { naming_templates: {} };
  return cache;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: USER_ID, naming_templates: settings.naming_templates });
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add library-tracker/src/lib/settings.ts
git commit -m "feat: add settings data layer with in-memory cache"
```

---

## Task 3: SettingsModal Component

**Files:**
- Create: `library-tracker/src/components/SettingsModal/index.tsx`

- [ ] **Step 1: Create the SettingsModal**

```tsx
import { useEffect, useRef, useState } from 'react';
import { THEME } from '../../lib/theme';
import {
  fetchSettings,
  fetchPublisherNames,
  saveSettings,
  type NamingTemplates,
} from '../../lib/settings';

type EditState = {
  default: string;
  publishers: Record<string, string>;
};

type AddForm = { name: string; template: string } | null;

const TOKENS = ['{TITLE}', '{PUBLISHER}', '{ALBUM}', '{VERSION}', '{CODE}'];

const PREVIEW_VALUES: Record<string, string> = {
  '{TITLE}': 'TrackTitle',
  '{PUBLISHER}': 'Publisher',
  '{ALBUM}': 'AlbumName',
  '{VERSION}': 'v1.00',
  '{CODE}': 'CODE01',
};

function renderPreview(template: string): string {
  return Object.entries(PREVIEW_VALUES).reduce(
    (s, [token, val]) => s.replaceAll(token, val),
    template,
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '6px 9px',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: 5,
  fontSize: 12,
  fontFamily: THEME.mono,
  color: THEME.ink,
  outline: 'none',
};

type Props = {
  onClose: () => void;
};

export function SettingsModal({ onClose }: Props) {
  const [editState, setEditState] = useState<EditState>({ default: '', publishers: {} });
  const [addForm, setAddForm] = useState<AddForm>(null);
  const [knownPublishers, setKnownPublishers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const focusedInputRef = useRef<HTMLInputElement | null>(null);
  const focusedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSettings(), fetchPublisherNames()])
      .then(([s, pubs]) => {
        setEditState({
          default: s.naming_templates.default ?? '',
          publishers: { ...(s.naming_templates.publishers ?? {}) },
        });
        setKnownPublishers(pubs);
      })
      .finally(() => setLoading(false));
  }, []);

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
      if (Object.keys(editState.publishers).length) templates.publishers = editState.publishers;
      await saveSettings({ naming_templates: templates });
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
          {renderPreview(template)}
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

          {/* Section heading */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
            textTransform: 'uppercase', color: THEME.inkMuted, marginBottom: 12,
          }}>
            File Naming Templates
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: THEME.inkMuted, fontSize: 13 }}>
              Loading…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Default card — green-tinted */}
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
                  placeholder="e.g. {PUBLISHER}_{ALBUM}_{TITLE}_{VERSION}"
                  onChange={(e) => setEditState((s) => ({ ...s, default: e.target.value }))}
                  onFocus={(e) => trackFocus('default', e)}
                />
                <TokenChips />
                <PreviewLine template={editState.default} />
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
                    placeholder="e.g. {CODE}_{TITLE}_{VERSION}"
                    onChange={(e) =>
                      setEditState((s) => ({
                        ...s,
                        publishers: { ...s.publishers, [name]: e.target.value },
                      }))
                    }
                    onFocus={(e) => trackFocus(name, e)}
                  />
                  <TokenChips />
                  <PreviewLine template={template} />
                </div>
              ))}

              {/* Add publisher form or button */}
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

                  {/* datalist for auto-suggest */}
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
                    placeholder="e.g. {CODE}_{TITLE}_{VERSION}"
                    onChange={(e) => setAddForm((f) => f ? { ...f, template: e.target.value } : f)}
                    onFocus={(e) => trackFocus('__add__', e)}
                  />
                  <TokenChips />
                  <PreviewLine template={addForm.template} />

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
git commit -m "feat: add SettingsModal with file naming template editor"
```

---

## Task 4: Wire Toolbar + App

**Files:**
- Modify: `library-tracker/src/components/Toolbar/index.tsx`
- Modify: `library-tracker/src/App.tsx`

- [ ] **Step 1: Add `onSettingsOpen` prop to Toolbar**

In `library-tracker/src/components/Toolbar/index.tsx`, update the `Props` type and function signature:

```ts
type Props = {
  trackCount: number;
  search: string;
  onSearch: (v: string) => void;
  filterStatus: string;
  onFilterStatus: (v: string) => void;
  filterInvoice: string;
  onFilterInvoice: (v: string) => void;
  inboxPendingCount: number;
  onInboxOpen: () => void;
  onNewFromBrief: () => void;
  onSettingsOpen: () => void;  // ← add this
};
```

Update the function signature:

```ts
export function Toolbar({
  trackCount,
  search,
  onSearch,
  filterStatus,
  onFilterStatus,
  filterInvoice,
  onFilterInvoice,
  inboxPendingCount,
  onInboxOpen,
  onNewFromBrief,
  onSettingsOpen,  // ← add this
}: Props) {
```

Add the gear button after the "New Brief" button (still inside the brand bar `div`):

```tsx
<button
  onClick={onSettingsOpen}
  title="Settings"
  style={{
    padding: '7px 10px',
    background: 'transparent',
    color: THEME.inkSoft,
    border: `1px solid ${THEME.border}`,
    borderRadius: 6,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}
>
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="7" cy="7" r="2" />
    <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" strokeLinecap="round"/>
  </svg>
</button>
```

- [ ] **Step 2: Wire SettingsModal in App.tsx**

Add import at the top of `library-tracker/src/App.tsx`:

```ts
import { SettingsModal } from './components/SettingsModal';
```

Add state after the existing `briefOpen` state:

```ts
const [settingsOpen, setSettingsOpen] = useState(false);
```

Update the `<Toolbar>` call to pass the new prop:

```tsx
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
```

Add the SettingsModal render, after the BriefModal block:

```tsx
{settingsOpen && (
  <SettingsModal onClose={() => setSettingsOpen(false)} />
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and verify manually**

```bash
cd library-tracker && npm run dev
```

Open `http://localhost:5173`. Confirm:
- Gear icon appears in the Toolbar to the right of "New Brief"
- Clicking it opens the Settings overlay
- The overlay shows "Your Default" card (green-tinted) and "+ Add publisher…" button
- Token chips appear; clicking one while the default input is focused inserts the token at the cursor
- Live preview updates as you type
- "+ Add publisher…" expands an inline form with a publisher name field and template field
- Adding a publisher creates a new card; Remove deletes it
- Save closes the modal; Cancel discards changes
- Re-opening the modal shows the previously saved templates

- [ ] **Step 5: Commit**

```bash
git add library-tracker/src/components/Toolbar/index.tsx library-tracker/src/App.tsx
git commit -m "feat: wire SettingsModal to Toolbar gear icon"
```

---

## Task 5: Brief Modal Fallback

**Files:**
- Modify: `library-tracker/src/components/BriefModal/index.tsx`
- Modify: `library-tracker/src/components/BriefModal/ReviewFields.tsx`

- [ ] **Step 1: Update ReviewFields to accept `fileNamingFromSettings` prop**

In `library-tracker/src/components/BriefModal/ReviewFields.tsx`, update `Props`:

```ts
type Props = {
  parsed: ParsedBrief;
  values: ReviewValues;
  onChange: (patch: Partial<ReviewValues>) => void;
  onSkipTitle: () => void;
  fileNamingFromSettings?: boolean;  // ← add this
};
```

Update the function signature:

```ts
export function ReviewFields({ parsed, values, onChange, onSkipTitle, fileNamingFromSettings }: Props) {
```

Add a neutral-tint style constant (alongside `extractedStyle`):

```ts
const settingsStyle: React.CSSProperties = {
  ...fieldStyle,
  borderColor: '#c4b8a8',
  background: '#f8f4ef',
};
```

Update the file naming field block to use the new style and label:

```tsx
{/* File naming — full width */}
<div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4 }}>
  <Label>File Naming System</Label>
  <input
    style={
      wasExtracted(values.file_naming, parsed.file_naming)
        ? extractedStyle
        : fileNamingFromSettings
        ? settingsStyle
        : fieldStyle
    }
    value={values.file_naming}
    placeholder="Not found in brief"
    onChange={(e) => onChange({ file_naming: e.target.value })}
  />
  {parsed.file_naming && (
    <span style={{ fontSize: 10, color: THEME.inkMuted }}>Found in brief — edit if needed</span>
  )}
  {!parsed.file_naming && fileNamingFromSettings && (
    <span style={{ fontSize: 10, color: THEME.inkMuted }}>From your settings — edit if needed</span>
  )}
</div>
```

- [ ] **Step 2: Update BriefModal to apply the fallback in `applyParsed`**

In `library-tracker/src/components/BriefModal/index.tsx`, add the import:

```ts
import { fetchSettings } from '../../lib/settings';
```

Add state after the existing `saving` state:

```ts
const [fileNamingFromSettings, setFileNamingFromSettings] = useState(false);
```

Replace the existing synchronous `applyParsed` function with this async version:

```ts
async function applyParsed(result: ParsedBrief) {
  let fileNaming = result.file_naming ?? '';
  let fromSettings = false;

  if (!fileNaming) {
    try {
      const s = await fetchSettings();
      const t = s.naming_templates;
      const publisherKey = result.publisher;
      if (publisherKey && t.publishers?.[publisherKey]) {
        fileNaming = t.publishers[publisherKey];
        fromSettings = true;
      } else if (t.default) {
        fileNaming = t.default;
        fromSettings = true;
      }
    } catch {
      // settings unavailable — leave field empty
    }
  }

  setParsed(result);
  setFileNamingFromSettings(fromSettings);
  setValues({
    code: result.code ?? '',
    version: 'v1.00',
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

Update both callers to `await` the now-async function. In `handleFile` and `handleText`, change the call from `applyParsed(result)` to `await applyParsed(result)`:

```ts
// handleFile — was: applyParsed(result)
await applyParsed(result);

// handleText — was: applyParsed(result)
await applyParsed(result);
```

Pass the new prop to ReviewFields:

```tsx
<ReviewFields
  parsed={parsed}
  values={values}
  onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
  onSkipTitle={handleSkipTitle}
  fileNamingFromSettings={fileNamingFromSettings}
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify fallback end-to-end**

With the dev server running (`npm run dev`):

1. Open Settings, set a default template e.g. `{PUBLISHER}_{TITLE}_{VERSION}`, save.
2. Click "New Brief", paste a brief that has a publisher but no file naming system.
3. Confirm the File Naming field in the Review step pre-fills with the default template, styled with the neutral tan tint and "From your settings" label.
4. Set a per-publisher template for a specific publisher in Settings. Submit a brief with that publisher.
5. Confirm the publisher-specific template takes priority over the default.
6. Submit a brief that includes its own file naming system.
7. Confirm it shows green (extracted from brief) and overrides any settings template.

- [ ] **Step 5: Commit**

```bash
git add library-tracker/src/components/BriefModal/index.tsx \
        library-tracker/src/components/BriefModal/ReviewFields.tsx
git commit -m "feat: pre-fill file naming from settings when brief omits it"
```

---

## Done

All five tasks complete. The feature is fully wired: Settings overlay → Supabase persistence → Brief modal fallback. Open the Settings via the gear icon to configure templates, then create a brief to see the fallback in action.

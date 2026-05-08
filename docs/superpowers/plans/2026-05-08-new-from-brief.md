# New from Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the "New from Brief" button to a centered modal that reads a brief file (PDF/DOCX/TXT/screenshot), extracts metadata via a Supabase edge function + Claude, lets the user review and edit everything, then creates the track and folder structure on explicit approval.

**Architecture:** A new `parse-brief` Supabase edge function receives the uploaded file, calls the Anthropic API (text/vision/document content depending on file type), and returns structured JSON. The frontend modal (`BriefModal`) manages a 4-step flow (Upload → Reading Brief → Review & Approve → Folders) in a single scrollable panel. Nothing is written to Supabase until the user clicks "Approve & Create Project".

**Tech Stack:** React + TypeScript (Vite), Supabase edge functions (Deno), Anthropic API (`claude-sonnet-4-6`), `react-dropzone` (already installed), `jszip` (already installed), File System Access API (browser-native)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260508000000_add_file_naming.sql` | Create | Add `file_naming` column to `tracks` table |
| `supabase/functions/parse-brief/deno.json` | Create | Deno imports config for edge function |
| `supabase/functions/parse-brief/index.ts` | Create | Edge function: receive file, call Claude, return JSON |
| `library-tracker/src/types/track.ts` | Modify | Add `file_naming: string \| null` to `Track` |
| `library-tracker/src/lib/parseBrief.ts` | Create | Client fn: POST file to edge function, return `ParsedBrief` |
| `library-tracker/src/lib/folderCreation.ts` | Create | File System Access API + JSZip fallback |
| `library-tracker/src/components/BriefModal/UploadZone.tsx` | Create | Drag-drop + text-paste upload area |
| `library-tracker/src/components/BriefModal/ReviewFields.tsx` | Create | Editable field grid for parsed metadata |
| `library-tracker/src/components/BriefModal/FolderBuilder.tsx` | Create | Folder list editor + Create/Zip buttons |
| `library-tracker/src/components/BriefModal/index.tsx` | Create | Modal shell + step orchestration |
| `library-tracker/src/components/Toolbar/index.tsx` | Modify | Add `onNewFromBrief` prop, wire existing button |
| `library-tracker/src/App.tsx` | Modify | Mount `BriefModal`, pass handler to `Toolbar` |

---

## Task 1: DB Migration — add `file_naming` column

**Files:**
- Create: `supabase/migrations/20260508000000_add_file_naming.sql`
- Modify: `library-tracker/src/types/track.ts`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260508000000_add_file_naming.sql
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS file_naming TEXT;
```

- [ ] **Step 2: Apply the migration**

Option A — Supabase CLI:
```bash
cd /Users/laurynvk/Documents/ClaudeProjects/LibraryTracker
supabase db push
```

Option B — Supabase dashboard SQL editor (if CLI not linked):
Paste and run the SQL from Step 1 directly in the dashboard.

Expected: no error, column appears in `tracks` table.

- [ ] **Step 3: Add `file_naming` to the Track type**

In `library-tracker/src/types/track.ts`, add after `brief_parsed_at`:

```typescript
export type Track = {
  id: string;
  created_at: string;
  code: string | null;
  title: string;
  album: string | null;
  version: string;
  status: StatusId;
  invoice: InvoiceStatus;
  due_date: string | null;
  publisher: string | null;
  publisher_email: string | null;
  fee: number | null;
  brief_link: string | null;
  folder_path: string | null;
  brief_parsed_at: string | null;
  file_naming: string | null;
  collaborators: string[];
  notes: string | null;
  activity: ActivityEvent[];
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260508000000_add_file_naming.sql library-tracker/src/types/track.ts
git commit -m "feat: add file_naming column to tracks"
```

---

## Task 2: `parse-brief` Edge Function

**Files:**
- Create: `supabase/functions/parse-brief/deno.json`
- Create: `supabase/functions/parse-brief/index.ts`

- [ ] **Step 1: Create deno.json**

```json
{
  "imports": {}
}
```

Save to `supabase/functions/parse-brief/deno.json`.

- [ ] **Step 2: Create the edge function**

Save to `supabase/functions/parse-brief/index.ts`:

```typescript
import mammoth from 'npm:mammoth';

export interface ParsedBrief {
  code: string | null;
  album: string | null;
  publisher: string | null;
  due_date: string | null;
  fee: string | null;
  file_naming: string | null;
}

const SYSTEM_PROMPT = `You are a metadata extractor for music library briefs. Extract project metadata and return ONLY valid JSON with exactly these keys:
- code: project/track reference code or number (string or null if not found)
- album: album or collection name (string or null)
- publisher: publisher or label name (string or null)
- due_date: deadline in ISO 8601 format YYYY-MM-DD (string or null)
- fee: fee or budget amount including currency symbol e.g. "£500", "$1,200" (string or null)
- file_naming: file naming convention or template if explicitly stated e.g. "LABEL_ALBUM_TrackName_v1.00" (string or null)

Return only the JSON object. No explanation, no markdown fences.`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return new Response('Missing API key', { status: 500 });

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'Expected multipart/form-data' }), { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const rawText = formData.get('text') as string | null;

  // Build Claude message content based on input type
  type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
    | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };

  let content: ContentBlock[];

  if (rawText) {
    content = [{ type: 'text', text: `Extract metadata from this brief:\n\n${rawText}` }];
  } else if (file) {
    const bytes = await file.arrayBuffer();
    const mime = file.type;

    if (mime === 'text/plain') {
      const text = new TextDecoder().decode(bytes);
      content = [{ type: 'text', text: `Extract metadata from this brief:\n\n${text}` }];
    } else if (mime === 'application/pdf') {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      content = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
        { type: 'text', text: 'Extract metadata from this brief.' },
      ];
    } else if (mime === 'image/png' || mime === 'image/jpeg') {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      content = [
        { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
        { type: 'text', text: 'Extract metadata from this brief image.' },
      ];
    } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ arrayBuffer: bytes });
      content = [{ type: 'text', text: `Extract metadata from this brief:\n\n${result.value}` }];
    } else {
      return new Response(JSON.stringify({ error: `Unsupported file type: ${mime}` }), { status: 400 });
    }
  } else {
    return new Response(JSON.stringify({ error: 'No file or text provided' }), { status: 400 });
  }

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    console.error('Claude error:', err);
    return new Response(JSON.stringify({ error: 'AI extraction failed' }), { status: 500 });
  }

  const claudeData = await claudeRes.json();
  const raw = claudeData.content?.[0]?.text ?? '{}';

  let parsed: ParsedBrief;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('JSON parse failed:', raw);
    return new Response(JSON.stringify({ error: 'Could not parse AI response' }), { status: 500 });
  }

  return new Response(JSON.stringify(parsed), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
```

- [ ] **Step 3: Deploy the edge function**

```bash
cd /Users/laurynvk/Documents/ClaudeProjects/LibraryTracker
supabase functions deploy parse-brief
```

Expected: `Deployed parse-brief` with a function URL.

- [ ] **Step 4: Smoke-test with curl (text input)**

```bash
curl -X POST \
  https://qnrtnhijkkjsqqbrsppd.supabase.co/functions/v1/parse-brief \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFucnRuaGlqa2tqc3FxYnJzcHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDEyMjYsImV4cCI6MjA5MzY3NzIyNn0.ln7DsO0XB_YJj8I8jqWSUa6nG0nEuL5qfjp8WX9coaE" \
  -F "text=Brief from Universal Music. Album: Summer Moods Vol. 3. Project code: LL-UMG-2405. Due: June 15 2024. Fee: £500. Name your files: UMG_SummerMoods3_TrackName_v1.00"
```

Expected response (values will vary):
```json
{
  "code": "LL-UMG-2405",
  "album": "Summer Moods Vol. 3",
  "publisher": "Universal Music",
  "due_date": "2024-06-15",
  "fee": "£500",
  "file_naming": "UMG_SummerMoods3_TrackName_v1.00"
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/parse-brief/
git commit -m "feat: add parse-brief edge function"
```

---

## Task 3: `parseBrief` Client Library

**Files:**
- Create: `library-tracker/src/lib/parseBrief.ts`

- [ ] **Step 1: Create the client library**

```typescript
// library-tracker/src/lib/parseBrief.ts

export interface ParsedBrief {
  code: string | null;
  album: string | null;
  publisher: string | null;
  due_date: string | null;
  fee: string | null;
  file_naming: string | null;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-brief`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function parseBriefFile(file: File): Promise<ParsedBrief> {
  const body = new FormData();
  body.append('file', file);
  return callParseBrief(body);
}

export async function parseBriefText(text: string): Promise<ParsedBrief> {
  const body = new FormData();
  body.append('text', text);
  return callParseBrief(body);
}

async function callParseBrief(body: FormData): Promise<ParsedBrief> {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ANON_KEY}` },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Brief parsing failed');
  }
  return res.json();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add library-tracker/src/lib/parseBrief.ts
git commit -m "feat: add parseBrief client lib"
```

---

## Task 4: `folderCreation` Client Library

**Files:**
- Create: `library-tracker/src/lib/folderCreation.ts`

- [ ] **Step 1: Create the library**

```typescript
// library-tracker/src/lib/folderCreation.ts
import JSZip from 'jszip';

export interface FolderSpec {
  albumName: string;
  topLevelFolders: string[];   // e.g. ['_DEMO2MX', 'Tracks', 'Print']
  trackTitle: string | null;   // if set, creates Tracks/{trackTitle} subfolder
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Uses the File System Access API to create folders directly on disk.
 * Prompts user to pick a parent directory, then creates albumName/ inside it.
 * Returns the album folder name on success, null if user cancelled the picker.
 */
export async function createFoldersOnDesktop(spec: FolderSpec): Promise<string | null> {
  const dirHandle = await (window as Window & { showDirectoryPicker: (opts?: object) => Promise<FileSystemDirectoryHandle> })
    .showDirectoryPicker({ mode: 'readwrite' });

  const albumDir = await dirHandle.getDirectoryHandle(spec.albumName, { create: true });

  for (const name of spec.topLevelFolders) {
    const subDir = await albumDir.getDirectoryHandle(name, { create: true });
    if (name === 'Tracks' && spec.trackTitle) {
      await subDir.getDirectoryHandle(spec.trackTitle, { create: true });
    }
  }

  // File System Access API doesn't expose the full path — return the album name only
  return spec.albumName;
}

/**
 * Generates a zip file containing the empty folder structure and triggers a download.
 * JSZip requires a placeholder file inside each folder to preserve empty directories.
 */
export async function createFoldersAsZip(spec: FolderSpec): Promise<void> {
  const zip = new JSZip();
  const album = zip.folder(spec.albumName)!;

  for (const name of spec.topLevelFolders) {
    const sub = album.folder(name)!;
    if (name === 'Tracks' && spec.trackTitle) {
      sub.folder(spec.trackTitle)!.file('.gitkeep', '');
    } else {
      sub.file('.gitkeep', '');
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${spec.albumName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manually verify zip in browser console (after dev server is running)**

In browser console at `http://localhost:5173`:
```javascript
import('/src/lib/folderCreation.ts').then(m => m.createFoldersAsZip({
  albumName: 'Test Album',
  topLevelFolders: ['_DEMO2MX', 'Tracks', 'Print'],
  trackTitle: 'My Track'
}));
```
Expected: browser downloads `Test Album.zip`. Unzip and verify the folder structure inside.

- [ ] **Step 4: Commit**

```bash
git add library-tracker/src/lib/folderCreation.ts
git commit -m "feat: add folder creation lib (File System API + zip)"
```

---

## Task 5: `UploadZone` Component

**Files:**
- Create: `library-tracker/src/components/BriefModal/UploadZone.tsx`

- [ ] **Step 1: Create the component**

```typescript
// library-tracker/src/components/BriefModal/UploadZone.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add library-tracker/src/components/BriefModal/UploadZone.tsx
git commit -m "feat: add BriefModal UploadZone component"
```

---

## Task 6: `ReviewFields` Component

**Files:**
- Create: `library-tracker/src/components/BriefModal/ReviewFields.tsx`

- [ ] **Step 1: Create the component**

```typescript
// library-tracker/src/components/BriefModal/ReviewFields.tsx
import { THEME } from '../../lib/theme';
import type { ParsedBrief } from '../../lib/parseBrief';

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
};

const fieldStyle: React.CSSProperties = {
  fontSize: 13, color: THEME.ink, background: '#fff',
  border: `1px solid ${THEME.border}`, borderRadius: 6,
  padding: '7px 10px', fontFamily: THEME.sans, outline: 'none', width: '100%',
};

const extractedStyle: React.CSSProperties = {
  ...fieldStyle,
  borderColor: '#b8d4b0', background: '#f4fbf3', color: '#2a6e22',
};

function wasExtracted(value: string, parsedValue: string | null): boolean {
  return !!parsedValue && value === parsedValue;
}

export function ReviewFields({ parsed, values, onChange, onSkipTitle }: Props) {
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
          <Label>Project Code</Label>
          <input
            style={wasExtracted(values.code, parsed.code) ? extractedStyle : fieldStyle}
            value={values.code}
            placeholder="Not found — add manually"
            onChange={(e) => onChange({ code: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>Version</Label>
          <input
            style={fieldStyle}
            value={values.version}
            onChange={(e) => onChange({ version: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>Album</Label>
          <input
            style={wasExtracted(values.album, parsed.album) ? extractedStyle : fieldStyle}
            value={values.album}
            placeholder="Not found — add manually"
            onChange={(e) => onChange({ album: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>Publisher</Label>
          <input
            style={wasExtracted(values.publisher, parsed.publisher) ? extractedStyle : fieldStyle}
            value={values.publisher}
            placeholder="Not found — add manually"
            onChange={(e) => onChange({ publisher: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>Due Date</Label>
          <input
            type="date"
            style={wasExtracted(values.due_date, parsed.due_date) ? extractedStyle : fieldStyle}
            value={values.due_date}
            onChange={(e) => onChange({ due_date: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>Fee</Label>
          <input
            style={wasExtracted(values.fee, parsed.fee) ? extractedStyle : fieldStyle}
            value={values.fee}
            placeholder="e.g. £500"
            onChange={(e) => onChange({ fee: e.target.value })}
          />
        </div>

        {/* File naming — full width */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label>File Naming System</Label>
          <input
            style={wasExtracted(values.file_naming, parsed.file_naming) ? extractedStyle : fieldStyle}
            value={values.file_naming}
            placeholder="Not found in brief"
            onChange={(e) => onChange({ file_naming: e.target.value })}
          />
          {parsed.file_naming && (
            <span style={{ fontSize: 10, color: THEME.inkMuted }}>Found in brief — edit if needed</span>
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, color: THEME.inkMuted,
      textTransform: 'uppercase', letterSpacing: '0.3px',
    }}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add library-tracker/src/components/BriefModal/ReviewFields.tsx
git commit -m "feat: add BriefModal ReviewFields component"
```

---

## Task 7: `FolderBuilder` Component

**Files:**
- Create: `library-tracker/src/components/BriefModal/FolderBuilder.tsx`

- [ ] **Step 1: Create the component**

```typescript
// library-tracker/src/components/BriefModal/FolderBuilder.tsx
import { THEME } from '../../lib/theme';
import {
  isFileSystemAccessSupported,
  createFoldersOnDesktop,
  createFoldersAsZip,
  type FolderSpec,
} from '../../lib/folderCreation';

export const DEFAULT_FOLDERS = ['_DEMO2MX', 'Tracks', 'Print'];

type Props = {
  albumName: string;
  trackTitle: string;       // empty string if skipped
  folders: string[];
  onFoldersChange: (folders: string[]) => void;
  onFolderPathSet: (path: string) => void;
};

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill={THEME.inkMuted} style={{ flexShrink: 0 }}>
      <path d="M2 4a2 2 0 012-2h3l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" />
    </svg>
  );
}

export function FolderBuilder({ albumName, trackTitle, folders, onFoldersChange, onFolderPathSet }: Props) {
  const fsSupported = isFileSystemAccessSupported();
  const spec: FolderSpec = {
    albumName: albumName || 'New Album',
    topLevelFolders: folders,
    trackTitle: trackTitle || null,
  };

  async function handleCreateOnDesktop() {
    try {
      const path = await createFoldersOnDesktop(spec);
      if (path) onFolderPathSet(path);
    } catch (e) {
      console.error('Folder creation failed:', e);
      alert('Could not create folders. Try downloading as zip instead.');
    }
  }

  async function handleDownloadZip() {
    await createFoldersAsZip(spec);
  }

  function updateFolder(index: number, value: string) {
    const next = [...folders];
    next[index] = value;
    onFoldersChange(next);
  }

  function removeFolder(index: number) {
    onFoldersChange(folders.filter((_, i) => i !== index));
  }

  function addFolder() {
    onFoldersChange([...folders, '']);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: THEME.inkMuted }}>
          Folder structure
        </span>
        {albumName && (
          <span style={{ fontSize: 11, color: THEME.inkMuted }}>
            Inside: <code style={{ fontFamily: THEME.mono, fontSize: 11 }}>{albumName}/</code>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {folders.map((name, i) => (
          <div key={i}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <FolderIcon />
              <input
                value={name}
                onChange={(e) => updateFolder(i, e.target.value)}
                style={{
                  flex: 1, fontSize: 12.5, color: THEME.ink,
                  background: '#fff', border: `1px solid ${THEME.border}`,
                  borderRadius: 6, padding: '5px 9px',
                  fontFamily: THEME.mono, outline: 'none',
                }}
              />
              <button
                onClick={() => removeFolder(i)}
                style={{
                  width: 24, height: 24, border: 'none', background: 'transparent',
                  color: THEME.border, cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 4, flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* Show track title subfolder hint under Tracks row */}
            {name === 'Tracks' && trackTitle && (
              <div style={{
                marginLeft: 30, marginTop: 3,
                fontSize: 11, color: '#2a6e22', fontFamily: THEME.mono,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="#2a6e22">
                  <path d="M2 4a2 2 0 012-2h3l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" />
                </svg>
                {trackTitle}/
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addFolder}
        style={{
          fontSize: 12, color: THEME.inkSoft, background: 'transparent',
          border: `1px dashed ${THEME.borderStrong}`, borderRadius: 6,
          padding: '5px 10px', cursor: 'pointer', fontFamily: THEME.sans,
          textAlign: 'left',
        }}
      >
        + Add folder
      </button>

      <div style={{ display: 'flex', gap: 8 }}>
        {fsSupported && (
          <button
            onClick={handleCreateOnDesktop}
            style={{
              flex: 1, padding: '8px 12px', background: '#2a6e22', color: '#fff',
              border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: THEME.sans,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            📁 Create on Desktop
          </button>
        )}
        <button
          onClick={handleDownloadZip}
          style={{
            flex: 1, padding: '8px 12px', background: '#fff', color: THEME.inkSoft,
            border: `1px solid ${THEME.border}`, borderRadius: 7, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', fontFamily: THEME.sans,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          ⬇ Download as Zip
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add library-tracker/src/components/BriefModal/FolderBuilder.tsx
git commit -m "feat: add BriefModal FolderBuilder component"
```

---

## Task 8: `BriefModal` Orchestrator

**Files:**
- Create: `library-tracker/src/components/BriefModal/index.tsx`

- [ ] **Step 1: Create the modal**

```typescript
// library-tracker/src/components/BriefModal/index.tsx
import { useState } from 'react';
import { THEME } from '../../lib/theme';
import { parseBriefFile, parseBriefText, type ParsedBrief } from '../../lib/parseBrief';
import { createTrack } from '../../lib/tracks';
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
  { id: 'review', label: 'Review & Approve' },
];

export function BriefModal({ onClose, onCreated }: Props) {
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

  async function handleFile(file: File) {
    setParseError(null);
    setLoadedFileName(file.name);
    setStep('reading');
    try {
      const result = await parseBriefFile(file);
      applyParsed(result);
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
      applyParsed(result);
    } catch (e) {
      setParseError((e as Error).message);
      setStep('upload');
    }
  }

  function applyParsed(result: ParsedBrief) {
    setParsed(result);
    setValues({
      code: result.code ?? '',
      version: 'v1.00',
      album: result.album ?? '',
      publisher: result.publisher ?? '',
      due_date: result.due_date ?? '',
      fee: result.fee ?? '',
      file_naming: result.file_naming ?? '',
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
        folder_path: folderPath,
        brief_parsed_at: new Date().toISOString(),
        collaborators: [],
        notes: null,
      });
      onCreated(track);
      onClose();
    } catch (e) {
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
            New from Brief
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
          display: 'flex', alignItems: 'center', padding: '10px 22px',
          background: THEME.surfaceAlt, borderBottom: `1px solid ${THEME.border}`,
        }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
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
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 1, background: THEME.border, margin: '0 8px' }} />
              )}
            </div>
          ))}
          {/* Folders — always last, always dim unless we're past review */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
            <div style={{ width: 1, height: 1, background: THEME.border, margin: '0 8px' }} />
            <div style={{
              width: 18, height: 18, borderRadius: '50%', fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: THEME.border, color: THEME.inkMuted,
            }}>
              4
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: THEME.inkMuted }}>Folders</span>
          </div>
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
              {/* Collapsed file row with Replace link */}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add library-tracker/src/components/BriefModal/
git commit -m "feat: add BriefModal orchestrator"
```

---

## Task 9: Wire Toolbar + App

**Files:**
- Modify: `library-tracker/src/components/Toolbar/index.tsx`
- Modify: `library-tracker/src/App.tsx`

- [ ] **Step 1: Add `onNewFromBrief` prop to Toolbar**

In `library-tracker/src/components/Toolbar/index.tsx`, update the `Props` type and button:

```typescript
// Add to Props type:
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
  onNewFromBrief: () => void;   // ← add this
};
```

Then update the destructure and wire the button's `onClick`:

```typescript
// Add onNewFromBrief to destructure:
export function Toolbar({
  trackCount, search, onSearch,
  filterStatus, onFilterStatus,
  filterInvoice, onFilterInvoice,
  inboxPendingCount, onInboxOpen,
  onNewFromBrief,   // ← add this
}: Props) {
```

Find the existing "New from Brief" button (the one with `THEME.accent` background) and add `onClick`:

```typescript
<button
  onClick={onNewFromBrief}
  style={{
    padding: '7px 14px',
    background: THEME.accent,
    // ... rest of existing styles unchanged
  }}
>
```

- [ ] **Step 2: Mount BriefModal in App.tsx**

In `library-tracker/src/App.tsx`, add the import and state:

```typescript
import { BriefModal } from './components/BriefModal';
```

Add state inside the `App` component (alongside existing state):

```typescript
const [briefOpen, setBriefOpen] = useState(false);
```

Add a handler for when a track is created:

```typescript
function handleBriefCreated(track: Track) {
  setTracks((prev) => [track, ...prev]);
}
```

Pass the new prop to `Toolbar`:

```typescript
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
/>
```

Add the modal alongside the existing `InboxDrawer`:

```typescript
{briefOpen && (
  <BriefModal
    onClose={() => setBriefOpen(false)}
    onCreated={handleBriefCreated}
  />
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and test the full flow**

```bash
cd library-tracker && npm run dev
```

Open `http://localhost:5173`. Test the golden path:
1. Click **"New from Brief"** — modal opens on Upload step
2. Drop a PDF or TXT file — modal moves to "Reading Brief"
3. After ~2–3s — modal shows Review & Approve with extracted fields highlighted in green
4. Edit a field, add a title, check the folder builder
5. Click **"Download as Zip"** — verify a zip downloads with the correct folder structure
6. Click **"✓ Approve & Create Project"** — modal closes, new row appears at the top of the track table with `status: brief`
7. Click the new row — TrackDrawer opens with all fields populated

- [ ] **Step 5: Commit**

```bash
git add library-tracker/src/components/Toolbar/index.tsx library-tracker/src/App.tsx
git commit -m "feat: wire New from Brief modal to Toolbar and App"
```

---

## Security Note

`VITE_ANTHROPIC_API_KEY` is currently in `.env.local`. The `VITE_` prefix exposes it to the browser bundle — do not use this key in any frontend code. The `parse-brief` edge function uses `Deno.env.get('ANTHROPIC_API_KEY')` (server-side only), which is safe. Consider removing `VITE_ANTHROPIC_API_KEY` from `.env.local` in a follow-up to avoid accidental use.

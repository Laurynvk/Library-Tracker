# New from Brief — Design Spec

**Date:** 2026-05-08
**Status:** Approved

---

## Overview

Clicking "New from Brief" in the Toolbar opens a centered modal that lets the user upload a brief (PDF, DOCX, TXT, or screenshot), reads the brief to extract project metadata, lets the user review and edit everything, then creates the track row and folder structure on approval.

Nothing is saved to the database until the user explicitly clicks **"Approve & Create Project"**.

---

## Flow

Step indicator across the top of the modal:

```
Upload → Reading Brief → Review & Approve → Folders
```

### Step 1 — Upload

- Drag-and-drop zone accepting: PDF, DOCX, TXT, PNG, JPG
- Also supports pasting raw text directly (for copy-pastes from emails)
- Once a file is loaded, the zone collapses to a compact "file loaded" row with a "Replace" link
- On file accepted → automatically advance to Step 2

### Step 2 — Reading Brief

- File is sent to a new Supabase edge function: `parse-brief`
- Edge function calls the Anthropic API to extract structured fields
- Modal shows a spinner/loading state while this runs (~2–3s)
- On success → advance to Step 3 (Review)
- On failure → stay on upload step, show inline error: "Couldn't read this brief — try a different file or paste the text directly"

### Step 3 — Review & Approve

A yellow banner at the top of this section reads: "Review before creating. Nothing is saved until you click Approve & Create Project."

All fields are editable. Green highlight = extracted from brief. No highlight = default value.

| Field | Source |
|-------|--------|
| Project Code | Extracted from brief |
| Version | Default `v1.00` (not extracted) |
| Album | Extracted from brief |
| Publisher | Extracted from brief |
| Due Date | Extracted from brief |
| Fee | Extracted from brief |
| File Naming System | Extracted from brief if present; blank if not found |

If a field is not found in the brief, it is left blank with placeholder text: "Not found — add manually".

**Title prompt** (below the fields):
> "Do you have a title for this track yet?"

- Text input for the title
- "Skip for now" button — title stored as empty string, can be added later

### Step 4 — Folders

Pre-filled with the default folder list (hardcoded):

```
_DEMO2MX/
Tracks/
  [Track Title]/    ← auto-created if title was entered in Step 3
Print/
```

If title was skipped, `Tracks/` is created empty. The user can add the title subfolder manually in Finder/Explorer once they have a title.

Each folder row has:
- A rename input
- A delete (×) button

An **"+ Add folder"** button appends a new empty row.

**Folder creation buttons:**
- **"Create on Desktop"** (primary) — uses the File System Access API. On first use, an OS picker lets the user choose the parent directory. qlogger creates the album folder and all subfolders. The resulting path is saved to `folder_path` on the track.
- **"Download as Zip"** (fallback) — generates a zip with the empty folder structure client-side. `folder_path` is left blank.

If the browser does not support the File System Access API (Safari, Firefox), the "Create on Desktop" button is hidden and only "Download as Zip" is shown.

### Footer

- **Cancel** — closes modal, nothing saved
- **✓ Approve & Create Project** — writes the track to Supabase, then triggers folder creation

---

## Data Model

### New database column

`file_naming` (text, nullable) on the `tracks` table — stores the naming convention extracted from the brief (e.g. `UMG_SummerMoods3_{TrackName}_v{Version}`).

### Track created on approval

```ts
{
  code,           // extracted from brief
  version: 'v1.00',
  album,          // extracted
  publisher,      // extracted
  due_date,       // extracted
  fee,            // extracted
  file_naming,    // extracted or null
  title,          // entered or ''
  folder_path,    // set if "Create on Desktop" used, otherwise null
  status: 'brief',
  invoice: 'unpaid',
  collaborators: [],
  notes: null,
}
```

### New edge function

`supabase/functions/parse-brief/index.ts`

- Accepts: multipart form with `file` (binary) or `text` (string)
- PDF/DOCX/TXT: text content extracted and sent as a text message to the Anthropic API
- PNG/JPG (screenshots): file base64-encoded and sent as image content using Claude's vision capability
- Returns JSON with the extracted fields above
- Follows the same auth/structure pattern as `inbound-email`

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Parse fails (bad file, API error) | Stay on upload step, show inline error, offer paste-text fallback |
| Field not found in brief | Field left blank with "Not found — add manually" placeholder |
| File System Access API unsupported | Hide "Create on Desktop", show only "Download as Zip" |
| User cancels mid-flow | Modal closes, nothing saved |
| Duplicate project code | No validation — user can edit the code field before approving |

---

## Out of Scope

- Splits (deferred indefinitely)
- Per-publisher file naming template in Settings (saved for Tweaks panel — see memory)
- Configurable default folder template in Settings (saved for Tweaks panel — see memory)
- Streaming parse (can revisit if 2–3s spinner feels too slow in practice)

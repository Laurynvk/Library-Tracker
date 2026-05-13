# CSV Import & Export — Design Spec

**Date:** 2026-05-13
**Status:** Approved

---

## Overview

CSV Import lets users bring their existing spreadsheet tracks into Library Tracker in one step. CSV Export lets users download their tracks at any time. Together they remove the "lock-in" concern and make onboarding frictionless — the PRD identifies import as the #1 onboarding lever.

---

## CSV Import

### Entry Point

The import button appears in the **empty state** of the track table — when a user has no tracks yet, a prompt appears:

```
📂  No tracks yet
    Bring in your existing spreadsheet or start fresh

    [ ↑ Import CSV ]   [ + Add track manually ]
```

After tracks exist, import is also available in the Settings modal under a "Data" section (alongside Export), but not prominently surfaced on the main screen.

### Flow — 3 Steps

#### Step 1 — Upload
A modal opens with a drag-and-drop zone. The user drops their CSV file or clicks "Choose file".

- Accepts `.csv` files only
- Helper hint: "Google Sheets: File → Download → CSV"

#### Step 2 — Preview & Filter
After the file is parsed, the modal shows:

- **Header:** "X tracks found"
- **Filter control (right-aligned, compact):** `Filter by [type ▾] [text input]`
  - Type dropdown options: Initials, Label, Status, Album
  - Text input: user types a value (e.g. "LK") — table filters live as they type
  - Filters the preview table in real time; updates the count
  - Optional — leaving it blank shows all tracks
- **Preview table:** TITLE, LABEL, STATUS, DATE DUE (first ~4 rows + "X more…")
- **Warning row** (if applicable): "⚠ N tracks have unrecognised status values — will default to 'brief'"
- **Footer:** `[ Import X tracks → ]  [ Cancel ]`

The import button count reflects the currently filtered set.

#### Step 3 — Done
Success screen inside the same modal:

- ✅ "X tracks imported"
- Note about any status defaults applied
- "Go to my tracks →" closes the modal and shows the track table

### Column Mapping

The importer reads these columns from the CSV (case-insensitive, trims whitespace):

| CSV Column | Library Tracker Field | Notes |
|---|---|---|
| TITLE | `title` | Required — rows without a title are skipped |
| VERS | `version` | |
| PROJECT CODE | `code` | |
| STATUS | `status` | Fuzzy-matched to valid status values; unrecognised → `"brief"` |
| DATE DUE | `due_date` | Parsed as a date; invalid dates ignored |
| ALBUM / ORDER | `album` | |
| LABEL | `publisher` | |
| WRITERS | `collaborators` | Split by comma into array |
| FKA | `notes` | Stored as `"FKA: [value]"` |
| COMP INT | Used for filtering only — not stored |

All other columns are silently ignored.

### Status Fuzzy Matching

Common spreadsheet status values mapped to Library Tracker statuses:

| Spreadsheet value (case-insensitive) | Maps to |
|---|---|
| brief, new, received | `brief` |
| writing, in progress, wip | `writing` |
| written, done, complete | `written` |
| revising, revision | `revising` |
| needs rev, needs revision, notes | `needs_rev` |
| sent, submitted, delivered to label | `sent` |
| approved, accepted | `approved` |
| delivered | `delivered` |
| hold, on hold | `hold` |
| rejected, passed, declined | `rejected` |
| anything else | `brief` (default, flagged in warning) |

### Behaviour

- **Append only** — imported tracks are added on top of any existing tracks; nothing is overwritten
- **Duplicate handling** — no deduplication in v1; user is responsible for not importing twice
- **Filtering** — filter uses `COMP INT` column to match against user-typed value (case-insensitive, partial match); same logic applies to Label, Status, Album filters
- **Minimum viable row** — a row must have at least a TITLE to be imported; blank rows skipped silently

---

## CSV Export

### Entry Point

A **"Export CSV"** option in the Settings modal under a "Data" section. Always accessible once the user has tracks.

### Behaviour

- Exports all tracks currently in the database for this user
- Column order: CODE, TITLE, VERSION, ALBUM, PUBLISHER, STATUS, INVOICE, FEE, DUE DATE, NOTES, COLLABORATORS, CREATED AT
- Filename: `library-tracker-export-YYYY-MM-DD.csv`
- Downloads immediately in the browser — no confirmation step needed

---

## What Is Not In Scope

- Editing the column mapping interactively (auto-mapping only)
- Merging/deduplicating on re-import
- Importing from Google Sheets directly (URL-based)
- Exporting a filtered subset of tracks
- Import history / undo

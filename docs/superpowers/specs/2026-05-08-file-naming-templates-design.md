# File Naming Templates — Design Spec
_2026-05-08_

## Overview

Users work with multiple publishers and clients, each with their own file naming conventions. When a brief includes a naming system the app already captures it per-track. This feature adds a Settings layer: per-publisher naming templates and a personal default, so the Brief review field is pre-filled intelligently even when a brief omits naming instructions.

---

## Data Model

### New table: `user_settings`

```sql
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  naming_templates JSONB NOT NULL DEFAULT '{}'
);
```

RLS: users can only read/write their own row.

### `naming_templates` shape

```json
{
  "default": "{PUBLISHER}_{ALBUM}_{TITLE}_{VERSION}",
  "publishers": {
    "Sony Music": "{CODE}_{TITLE}_SM_{VERSION}",
    "Warner": "{ALBUM}_{TITLE}_WMG"
  }
}
```

`publishers` is a flat map of publisher name → template string. `default` is the fallback when no publisher entry matches.

### Available tokens

| Token | Resolves to |
|---|---|
| `{TITLE}` | Track title |
| `{PUBLISHER}` | Publisher name |
| `{ALBUM}` | Album name |
| `{VERSION}` | Version string (e.g. `v1.02`) |
| `{CODE}` | Project code |

---

## UI Components

### Toolbar — gear icon

A `⚙` icon added to the right side of the Toolbar, after "New Brief". Clicking it opens the SettingsModal.

### SettingsModal

Centered overlay, same visual pattern as BriefModal. Single section on launch: **File Naming**.

Changes are saved only when the user clicks a **Save** button in the modal footer (not auto-saved on keystroke). Closing the modal without saving discards unsaved edits.

**Layout (card stack — Option B):**

- **Your Default card** — green-tinted, always present, always at the top. Contains the default template input, token chips, and a live preview line.
- **Per-publisher cards** — one card per saved publisher entry. Each card shows:
  - Publisher name (read-only label)
  - Template text input
  - Clickable token chips (inserts at cursor)
  - Live preview line with placeholder values
  - Remove button
- **"+ Add publisher…"** — expands an inline form with:
  - Publisher name field — auto-suggests from distinct `publisher` values already in the tracks table, but accepts any manual input
  - Template field + token chips
  - Save / Cancel

### Token chip interaction

Clicking a token chip calls `input.setRangeText(token, start, end, 'end')` to insert it at the current cursor position in the focused template input. The live preview updates on every keystroke.

### Live preview

Placeholder values used for preview rendering:

```
{TITLE} → "TrackTitle"
{PUBLISHER} → "Publisher"
{ALBUM} → "AlbumName"
{VERSION} → "v1.00"
{CODE} → "CODE01"
```

Preview is a single line below the input: `Preview: Publisher_AlbumName_TrackTitle_v1.00`

---

## Settings data layer — `lib/settings.ts`

- `fetchSettings(): Promise<UserSettings>` — fetches the user's row from `user_settings`, upserts an empty row if none exists
- `saveSettings(settings: UserSettings): Promise<void>` — upserts the row
- Thin in-memory cache: the fetched value is stored in a module-level variable so re-opening the modal doesn't round-trip Supabase again. Cache is invalidated on `saveSettings`.

```ts
type NamingTemplates = {
  default?: string;
  publishers?: Record<string, string>;
};

type UserSettings = {
  naming_templates: NamingTemplates;
};
```

---

## Fallback logic — Brief modal review step

After brief parsing, the `file_naming` field in ReviewFields is pre-filled using this priority:

1. **Brief's own value** — if the AI extracted a naming system, use it. Shown green ("Found in brief").
2. **Publisher template** — if the parsed publisher name matches a key in `naming_templates.publishers`, use that template. Shown with a neutral tint and label "From your settings".
3. **User default** — if no publisher match, use `naming_templates.default` if set. Same neutral tint, "From your settings".
4. **Empty** — if nothing is configured, the field is blank.

The field is always editable regardless of source.

Implementation: after `parseBriefFile`/`parseBriefText` resolves, `fetchSettings()` is called (cheap due to cache) and the fallback is applied before the Review step renders.

---

## Database migration

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  naming_templates JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own settings"
  ON user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## What's out of scope

- Folder templates (flagged for a future Settings section, same modal)
- Importing/exporting templates
- Validating that tokens in a template actually have values on a given track (empty token values just render as empty string)

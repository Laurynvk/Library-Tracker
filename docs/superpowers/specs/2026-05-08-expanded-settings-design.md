# Expanded Settings — Design Spec
_2026-05-08_

## Overview

Adds three new settings to the existing Settings modal: **Initials** (used as the `{INITIALS}` token in file naming templates), **Default Version String** (substituted for `{VERSION}` in new briefs), and **Dark Mode** (system-wide theme toggle). No new database tables are needed — all three fields extend the existing `user_settings.naming_templates` JSONB column by widening the TypeScript type.

---

## Data Model

### Extending `UserSettings` — no migration required

The existing `user_settings` table stores a JSONB column. The TypeScript type in `lib/settings.ts` is widened; the database schema is unchanged.

**Before:**
```ts
type UserSettings = {
  naming_templates: NamingTemplates;
};
```

**After:**
```ts
type UserSettings = {
  naming_templates: NamingTemplates;
  initials?: string;
  default_version?: string;
  dark_mode?: boolean;
};
```

All three new fields are optional and default to `undefined` when the row predates this feature. Existing rows will continue to load without error.

---

## Settings Modal UI

### "General" section

A new section is added above the existing "File Naming Templates" section. It contains three controls:

**Initials field**
- Single-line text input, max ~6 characters (no hard validation — the user types what they like)
- Label: "Your Initials"
- Hint: "Used as `{INITIALS}` in file naming templates"
- Saved to `user_settings.initials`

**Default Version String field**
- Single-line text input
- Label: "Default Version"
- Placeholder: `v1.00`
- Hint: "Starting version when you create a new brief"
- Saved to `user_settings.default_version`

**Dark Mode toggle**
- Standard checkbox / toggle switch
- Label: "Dark Mode"
- Saved to `user_settings.dark_mode`

### Save behaviour

All three new fields are saved by the existing Save button in the modal footer alongside the naming templates. No separate save action.

### Initials reflected in PREVIEW_VALUES

When the user has typed initials, the live preview in the File Naming Templates section should use the actual initials instead of the placeholder `'LL'`. The `PREVIEW_VALUES` map in `SettingsModal/index.tsx` is updated at render time:

```ts
const livePreviewValues = {
  ...PREVIEW_VALUES,
  '{INITIALS}': editState.initials || 'LL',
};
```

---

## Theme System

### `lib/theme.ts`

- Add a `DARK_THEME` constant alongside the existing `THEME` constant. `DARK_THEME` uses the same key names but dark values (dark background, light ink, adjusted borders and accents).
- Export a `ThemeContext` (React context whose value is a theme object).
- Export a `useTheme()` hook that reads from `ThemeContext`.

```ts
export const ThemeContext = React.createContext(THEME);
export function useTheme() { return useContext(ThemeContext); }
```

### `App.tsx`

On mount, `App` loads settings (already done for Brief modal). It reads `dark_mode` from the fetched settings and stores it in a `darkMode` state boolean. It wraps the entire render output in `<ThemeContext.Provider value={darkMode ? DARK_THEME : THEME}>`.

When the user saves new settings with a changed `dark_mode` value, the provider re-renders with the new theme, switching the entire UI.

### Component updates (~8 files)

Every component that currently does `import { THEME } from '../../lib/theme'` and uses `THEME` directly is updated to call `useTheme()` instead:

```ts
// Before
import { THEME } from '../../lib/theme';
// ... THEME.ink, THEME.accent, etc.

// After
import { useTheme } from '../../lib/theme';
// ...
const THEME = useTheme();
```

The local `THEME` name is preserved so that no inline style expressions need changing — only the import + declaration line changes per file.

Affected files (approximate — to be confirmed during implementation):
- `components/SettingsModal/index.tsx`
- `components/Toolbar/index.tsx`
- `components/BriefModal/index.tsx`
- `components/BriefModal/ReviewFields.tsx`
- `components/TrackTable/index.tsx` (or equivalent)
- `components/DetailDrawer/index.tsx` (or equivalent)
- `components/InboxPanel/index.tsx` (or equivalent)
- `App.tsx`

### `BriefModal` — `default_version` substitution

When `applyParsed` builds the initial ReviewFields state after brief parsing, the hardcoded `'v1.00'` default for an empty version is replaced with `settings.default_version ?? 'v1.00'`. Since `fetchSettings()` is already called in `applyParsed`, no additional fetch is needed.

---

## What's out of scope

- **Default Folder Structure** — deferred to a future Settings section
- **Display Preferences** — deferred to a future Settings section
- **Profile / Name** — not selected; deferred
- Per-publisher initials or version overrides
- Persisting dark mode via `localStorage` (Supabase is the source of truth)

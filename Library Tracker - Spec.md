# Library Tracker — Design Spec

A desktop web app for a songwriter to manage track briefs, project codes, statuses, invoicing, folders on disk, and email-driven updates. Designed for Lauryn (initials **LL**), who works with publishers and music libraries (APM, Position Music, Extreme Music, Sony PM, Warner Chappell PM, Universal Production Music, etc.).

This document is a handoff spec for an engineering agent. It describes the data model, flows, components, and visual system at enough detail to build a working v1.

---

## 1. Product summary

**Job to be done:** "When a brief comes in, generate the project code, capture the metadata, create the desktop folder, and keep the track's status in sync with what's happening in my inbox — without me having to type anything twice."

**Primary user:** A working songwriter / library composer juggling 6–20 active tracks across multiple publishers.

**Platform:** Desktop web app (Mac-first). Should also work in a wrapped desktop shell (Electron / Tauri) so it can read/write the local filesystem and sync via iCloud or Dropbox.

**Core loop:**
1. Brief arrives (PDF, screenshot, or link).
2. User drops it into the app.
3. App parses it, suggests a project code + metadata, user confirms.
4. App creates the desktop folder structure.
5. Track appears in the table.
6. As emails come in about the track, the app proposes status updates; user approves.
7. Invoicing, fee, and delivery state stay current without manual entry.

---

## 2. Data model

### Track
```ts
type Track = {
  id: string;                 // uuid
  code: string;               // generated from codeFormat, e.g. "DCD Hollow Coast v1.00 LL 2mx"
  title: string;              // "Tide Pull"
  album: string;              // "Hollow Coast"
  version: string;            // "1.00"  (drives the {VERSION} token)
  status: StatusId;           // see Status pipeline
  publisher: string;          // "Position Music"
  publisherEmail?: string;    // "sarah@positionmusic.com" — used for inbox matching
  fee: number;                // 2400  (USD assumed; locale later)
  invoice: 'unpaid' | 'invoiced' | 'paid';
  dueDate: string | null;     // ISO date
  briefLink?: string;         // url OR local path to uploaded PDF/image
  collaborators: string[];    // ["LL", "MJ"]
  folderPath: string;         // "~/Desktop/DCD/Hollow Coast/DCD Hollow Coast v1.00 LL 2mx"
  createdAt: string;          // ISO
  activity: ActivityEvent[];  // append-only log
};

type ActivityEvent = {
  at: string;                 // ISO
  kind: 'created' | 'status_change' | 'email_matched' | 'invoice_change' | 'note';
  from?: string;
  to?: string;
  source?: 'user' | 'email' | 'ai';
  detail?: string;
};
```

### Status pipeline (default)
Editable in Tweaks. Default order matters — it's the canonical pipeline.

| id          | label           | color (hex) |
|-------------|-----------------|-------------|
| `brief`     | Brief received  | `#a89b8a`   |
| `writing`   | Writing         | `#c9a14a`   |
| `written`   | Written         | `#7c8a5c`   |
| `revising`  | Revising        | `#b06a3b`   |
| `needs_rev` | Needs revision  | `#c44545`   |
| `sent`      | Demo sent       | `#5a7fb0`   |
| `approved`  | Approved        | `#3d8a5f`   |
| `delivered` | Delivered       | `#2c2a26`   |
| `hold`      | On hold         | `#8a8a8a`   |
| `rejected`  | Rejected        | `#6e3535`   |

### Project code format
A user-editable template string. Default:

```
DCD {EP_TITLE} v{VERSION} {INITIALS} 2mx
```

**Tokens:**
- `{EP_TITLE}` → the album/EP name (title-cased, spaces preserved)
- `{VERSION}` → `1.00`, `2.00`, etc. (two decimals; bumps on each new version)
- `{INITIALS}` → user initials (`LL`)
- `{DATE}` → `YYYY-MM-DD` (optional, not in default)
- `{TRACK}` → track title (optional)

The code is the **filesystem-safe identifier** for the project — it's also the folder name on disk.

### Folder template
Default tree created on disk for each new project:

```
~/Desktop/DCD/{EP_TITLE}/{CODE}/
  ├── TRACK/
  └── DEMO 2MXS/
```

User can edit the template in Tweaks. Common variants to support:
- Add `BRIEF/`, `STEMS/`, `REFERENCES/`, `NOTES/`
- Reorder
- Nest deeper (e.g. `DEMO 2MXS/v1`, `DEMO 2MXS/v2`)

### Inbox item
```ts
type InboxItem = {
  id: string;
  from: string;          // "sarah@apmmusic.com"
  fromName: string;      // "Sarah Chen"
  subject: string;       // "Re: Slow Burn revisions"
  snippet: string;       // first ~140 chars
  receivedAt: string;    // ISO
  matchedTrackId: string | null;  // null = unmatched, user picks
  proposedStatus: StatusId | null;
  proposedReason: string;        // AI-written one-liner: "Mentions 'two notes on second verse'"
  state: 'pending' | 'approved' | 'dismissed';
};
```

---

## 3. Screens & components

The prototype ships **two visual variants** of the same app, side-by-side in a design canvas. They share data, components, and flows. Pick one or let the user toggle.

### Variant A — "Warm Paper"
Cream background (`#f4ede0`), warm orange-rust accent (`#b8593a`), serif display + sans body, soft shadows, subtle paper grain. Feels like a producer's notebook.

### Variant B — "Studio Console"
Near-black background (`#0e0d0b`), same orange accent re-tuned for dark, all-caps mono labels, tighter density, hairline dividers. Feels like a DAW session window or a hardware console.

Both variants render the same components — only tokens differ.

### 3.1 Main view: the table
A sortable spreadsheet, **the single source of truth**. Default columns:

| Column          | Notes                                                          |
|-----------------|----------------------------------------------------------------|
| Project Code    | Mono. The full generated code. Click → opens detail drawer.    |
| Track           | Title.                                                         |
| Album           | EP / project name.                                             |
| Status          | Pill, color from pipeline.                                     |
| Publisher       | Plain text (truncate w/ ellipsis on overflow).                 |
| Fee             | `$X,XXX`, right-aligned.                                       |
| Invoice         | Small badge: `UNPAID` / `INVOICED` / `PAID`. Click to cycle.   |
| Due             | `Mon DD`. Sort indicator on this column by default (ascending).|

**Toolbar above the table:**
- Search input (filters across code, title, publisher).
- Status filter dropdown (`All statuses` + each status).
- Invoice filter dropdown (`All invoice` / unpaid / invoiced / paid).
- Right side: `Inbox [N]` button (badged with pending count) + `+ New from Brief` (primary CTA).

**Footer (status bar):**
- `N active` · `BILLED $X` · `PAID $X` · `OUTSTANDING $X` (the gap) · sync indicator (`SYNCED iCLOUD · 4m ago`).

**Density modes:**
- **Comfortable** — 44px row height, more breathing room.
- **Compact** — 32px row height, denser for power-use.

### 3.2 Detail drawer (right side, slides in)
Opens when a row is clicked. Width ~420px. Contains:

- **Header:** Project code (mono, large) + close button.
- **Track title** (editable inline).
- **Status selector** — vertical list of statuses, current one highlighted, click to change. Logs an activity event.
- **Metadata grid:** Album, Publisher, Fee, Invoice, Due Date, Collaborators, Brief link.
- **Folder path** — mono, with a "Reveal in Finder" button (no-op in web prototype; works in Electron build).
- **Activity feed** — reverse-chronological list of events. Each row: timestamp · icon · plain-English summary. Email-matched events show the email sender + a "view email" link.

### 3.3 Brief uploader modal
The headline flow. Triggered by `+ New from Brief`.

**Step 1 — Drop:** A large dropzone with three input modes:
- Drag a PDF or image
- Click to browse
- Paste a link (Google Doc, Notion, Dropbox)

While processing, show a 1-second "AI is reading the brief" state.

**Step 2 — Confirm parsed details:**
A form prefilled from AI parsing. Every field editable. Top of form: the **generated project code**, prominently displayed in the accent color, with an "edit pattern" link (jumps to Tweaks).

Fields: Track title, Album, Publisher, Fee, Due date, Collaborators, Notes.

Buttons: `Back` / `Looks good →`

**Step 3 — Confirm folder structure:**
Shows the tree that's about to be created on disk:

```
~/Desktop/DCD/Hollow Coast/
  └── DCD Hollow Coast v1.00 LL 2mx/
      ├── TRACK/
      └── DEMO 2MXS/
```

User can:
- Add a folder (button: `+ Add folder`)
- Rename inline
- Delete
- Drag to reorder/nest
- Save the modified tree as the new default template (checkbox)

Buttons: `Back` / `Create on Desktop`

**Step 4 — Done:**
Brief confirmation: "Project created. Folder opened in Finder." with an "Open project" link that opens the detail drawer.

### 3.4 Inbox panel
Slides in from the right when the `Inbox [N]` button is clicked. Width ~480px.

**Header:** "Inbox · N pending" + a settings cog (auto-approve trusted senders, etc.).

**List of inbox items.** Each item card shows:
- Sender name + email + timestamp ("2:22pm" / "Yesterday" / "Mar 14")
- Subject line (medium weight)
- 2-line snippet (muted)
- **The proposal block** — accent-tinted background:
  > Proposing: **Needs revision** on `DCD Lowlight v2.00 LL 2mx`
  > _Reason: "Mentions 'two notes on the second verse'"_
- Two buttons: `Approve` (filled, accent) / `Dismiss` (outline).

**Empty state:** "Inbox is clear. We'll let you know when an email needs your attention."

**Settings (cog menu):**
- Auto-approve from trusted senders (toggle + manage list)
- Pause inbox watching
- Reconnect Gmail / Outlook

### 3.5 Tweaks panel
Floating bottom-right when Tweaks toggle is on (toolbar control). Sections:

1. **Layout** — density radio (Comfortable / Compact)
2. **Theme** — variant radio (Paper / Console) + accent color swatches (4 curated)
3. **Code format** — pattern textfield with token reference legend
4. **Status pipeline** — list of statuses (drag to reorder, click to rename, color picker per status, `+ Add status` button, delete (with confirmation if any tracks use it))
5. **Folder template** — same tree editor as Step 3 of the upload flow, but persistent
6. **Reset** — "Reset all data" button (with confirm)

---

## 4. The four flows

### Flow 1 — New brief → folder on disk
1. Click `+ New from Brief`.
2. Drop a PDF / paste a link.
3. App calls AI to extract: track title, album, publisher, fee, due date, collaborators, notes. Returns structured JSON.
4. User reviews/edits parsed fields. Project code regenerates live as `EP_TITLE` and `VERSION` change.
5. User reviews folder tree (defaults to template).
6. App creates `~/Desktop/DCD/{EP_TITLE}/{CODE}/` and subfolders. Drops the original brief file into the project root (or a `BRIEF/` subfolder if the template has one).
7. New `Track` record persists. Activity event: `created` (source: user).

**Web fallback:** if not running in a desktop shell, generate a `.zip` of the empty folder structure and trigger a download. Also write a `setup.sh` script the user can run.

### Flow 2 — Status update via the table
- Click a status pill in the table → popover with all statuses → click new one → updates immediately. Activity event logged.
- Or open the drawer and use the vertical status list.

### Flow 3 — Inbox-driven status update
1. New email arrives in connected Gmail/Outlook.
2. Backend (or local watcher) fetches it.
3. Matching: try project code in subject → publisher email domain → fuzzy match on track title. If no match, item appears in Inbox with `matchedTrackId: null` and a "pick a track" picker.
4. AI reads the body and proposes one of: `needs_rev`, `approved`, `revising`, `delivered`, or `none` (no proposal — just for awareness).
5. Item appears in Inbox panel with proposal.
6. User clicks Approve → track status updates, activity event logged with `source: 'email'`, email is archived/labelled in Gmail/Outlook.
7. User clicks Dismiss → item disappears, no state change.

**Why propose-don't-auto-apply:** publishers' emails are ambiguous. "Approved the budget" ≠ track approved. AI guesses; user confirms in one tap. Keeps user in control without keeping them in busywork.

**Auto-approve trusted senders:** opt-in per sender. After 5 successful approvals from the same sender, app suggests adding them to the trusted list.

### Flow 4 — Invoicing
- Click the `UNPAID` badge on a row → cycles to `INVOICED` → `PAID` → back.
- Activity event logged.
- Footer totals update live.

---

## 5. Visual system (tokens)

### Variant A — Warm Paper
```css
--bg:           #f4ede0;
--surface:      #faf5ea;
--surface-2:    #ede4d3;
--ink:          #2c2a26;
--ink-soft:     #6b6258;
--ink-muted:    #948b7e;
--border:       #d9cfbc;
--border-strong:#b8ac95;
--accent:       #b8593a;
--accent-soft:  #b8593a20;  /* 12% */
--success:      #3d8a5f;
--danger:       #c44545;
--warn:         #c9a14a;

--font-sans:    'Inter Tight', 'SF Pro Text', system-ui, sans-serif;
--font-display: 'Fraunces', 'Iowan Old Style', Georgia, serif;
--font-mono:    'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
```

(Note: per house style, prefer alternatives to Inter / Fraunces / system-ui in production. Suggested swaps: `Söhne` or `Geist` for sans, `Söhne Mono` for mono, `GT Sectra` or `Tiempos` for display. Adjust if the team has a license.)

### Variant B — Studio Console
```css
--bg:           #0e0d0b;
--surface:      #16140f;
--surface-2:    #1f1c16;
--ink:          #f0e9d8;
--ink-soft:     #a9a191;
--ink-muted:    #6e6759;
--border:       #2a2620;
--border-strong:#3a342a;
--accent:       #d97557;     /* lighter orange for dark */
--accent-soft:  #d9755728;   /* ~16% */
```

Same fonts, but **labels and column headers are uppercase mono** in this variant — leans into the DAW vibe.

### Spacing / radii
- Base spacing: 4px grid (4 / 8 / 12 / 16 / 24 / 32 / 48).
- Radii: 4 (chips, badges), 6 (inputs, buttons), 10 (cards, modals), 14 (drawers).
- Shadows: barely-there in Paper (`0 1px 2px rgba(0,0,0,0.04)`), none in Console (use 1px borders instead).

### Density
| Token              | Comfortable | Compact |
|--------------------|-------------|---------|
| Row height         | 44px        | 32px    |
| Cell padding-y     | 12px        | 6px     |
| Font size (body)   | 13.5px      | 12.5px  |
| Toolbar height     | 56px        | 44px    |

### Typography
- **Display** (page titles, modal titles): Fraunces / serif, 24–32px, weight 500–600, letter-spacing -0.02em.
- **Body**: 13–14px, weight 400.
- **Labels** (column headers, section labels): 10–11px, uppercase, letter-spacing 0.06em, weight 600, muted color.
- **Mono** (codes, paths, timestamps): 12–13px.
- **Numbers** in the table: tabular-nums.

---

## 6. State, persistence, sync

**v1 (web prototype):**
- All state in `localStorage` under a single key. Single user, single device.
- Brief uploads stored as base64 in localStorage (or IndexedDB once they get big).

**v2 (desktop shell):**
- State in a local SQLite file in `~/Library/Application Support/LibraryTracker/`.
- The "folder on disk" is real — created via Node `fs` from Electron/Tauri.
- Sync via the user's existing iCloud/Dropbox/Drive folder (let them pick the root). State file goes there too, so multi-device works without a backend.

**v3 (multi-user / cloud):**
- Postgres + auth.
- Real-time updates via websocket.
- Real Gmail/Outlook OAuth + a polling backend.

---

## 7. AI integrations

Three AI calls in the v1 design:

### 7.1 Brief parsing
**Input:** PDF text (extracted via pdf.js) OR image (sent as base64 to vision model) OR a fetched URL's content.
**Prompt:** "Extract the following fields from this music brief: track title, album/project, publisher, fee (USD), due date (ISO), collaborator initials, notes. Return JSON. If a field isn't present, return null."
**Output:** JSON matching the prefill form.

### 7.2 Email status inference
**Input:** Email body + the matched track's current status + the full status pipeline.
**Prompt:** "This email is about a track currently in status '{currentStatus}'. Read the email and propose the most likely next status, OR 'none' if the email doesn't suggest a status change. Also write a one-sentence reason quoting the relevant phrase. Return JSON: { proposedStatus, reason }."
**Output:** populates the inbox card.

### 7.3 Email-to-track matching (only if subject parsing fails)
**Input:** Email subject + sender + the list of active tracks (code, title, publisher).
**Prompt:** "Which of these tracks is this email most likely about? Return the track id, or null if no good match."
**Output:** populates `matchedTrackId`.

All three should run server-side in production (API key safety). In the web prototype, they can run client-side via `window.claude.complete`.

---

## 8. Email integration (when real)

**Gmail (recommended first):**
- OAuth 2.0 with Gmail API scope `gmail.modify`.
- Server polls every 60s (or uses Gmail push notifications via Pub/Sub).
- Filter: only emails from senders whose domain matches a known publisher, OR whose subject contains a project code.
- After processing: apply a Gmail label (`Library Tracker / Processed`) and archive from inbox.

**Outlook (v2):** same shape, Microsoft Graph API.

**Manual fallback:** a unique forwarding address per user (`u_abc123@inbox.librarytracker.app`). User sets up a Gmail filter to forward matching emails. Server processes the same way.

---

## 9. Edge cases & rules

- **Two tracks on the same EP with the same version number:** disallow — code must be unique. Prompt user to bump version.
- **Brief upload fails to parse anything:** show the form blank, user fills manually. Don't block.
- **Publisher domain matches multiple tracks:** the inbox item lists all candidates, user picks.
- **User edits the project code after creation:** rename the folder on disk too (with a confirmation dialog warning that any external references will break).
- **User deletes a status that has tracks in it:** force them to migrate those tracks first.
- **Offline:** all reads from local state work. Writes queue and sync when online (in v3).

---

## 10. Out of scope for v1

- Mobile app (the prototype is desktop-first; mobile comes later)
- Multi-user collaboration on the same library
- Time tracking / timesheets
- Royalty / split-sheet management
- DAW integration (export sessions, etc.)
- Calendar view (could be added; for v1 the table is enough)

---

## 11. File / module structure (suggested)

```
src/
  app.tsx                 // root + variant switcher
  state/
    store.ts              // localStorage adapter, all reads/writes go through here
    seed.ts               // dev seed data
    types.ts              // Track, Status, InboxItem, etc.
    codeFormat.ts         // applyCodeFormat(pattern, vars)
  components/
    Table/
    Drawer/
    BriefUploader/        // 4-step modal
    FolderTreeEditor/     // shared between uploader step 3 and Tweaks
    Inbox/
    TweaksPanel/
  themes/
    paper.ts
    console.ts
    tokens.ts
  ai/
    parseBrief.ts
    inferStatus.ts
    matchTrack.ts
  desktop/                // Electron/Tauri only
    fs.ts                 // createProjectFolder, revealInFinder
    ipc.ts
```

---

## 12. Definition of done for v1

- [ ] Table renders all fields, sortable, filterable, dense/comfortable toggle works.
- [ ] Brief upload flow: drop → parse → confirm → folder confirm → created. All four steps editable.
- [ ] Project code regenerates live from the pattern + EP title + version + initials.
- [ ] Folder tree editor works in both upload step 3 and Tweaks (single shared component).
- [ ] Detail drawer opens, all fields edit inline, activity feed renders.
- [ ] Inbox panel renders mock items, approve/dismiss updates track status.
- [ ] Tweaks: density, accent color, code pattern, status pipeline (CRUD), folder template (CRUD), reset.
- [ ] Both visual variants pixel-match the prototype.
- [ ] State survives reload (localStorage) in web build.
- [ ] In Electron build: real folder creation on disk, real Gmail OAuth + polling.

---

*End of spec. Reference design: `Library Tracker.html` in this project.*

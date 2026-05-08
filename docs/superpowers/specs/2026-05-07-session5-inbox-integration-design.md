# Session 5 — Inbox Integration Design Spec

**Date:** 2026-05-07
**Status:** Approved

---

## What we're building

An inbox integration that watches for Pibox notification emails and automatically proposes status updates for matching tracks. When a publisher comments, approves, or requests changes on Pibox, Library Tracker reads the forwarded email and surfaces a proposal card in the app. The user approves or dismisses with one tap.

---

## How it works (plain terms)

**One-time setup (user does this once):**
1. User opens the Inbox panel — the app generates a unique forwarding address (e.g. `u_k7x2m9@inbound.librarytracker.app`)
2. User creates one Gmail filter: forward emails from Pibox's notification address to their Library Tracker address (user needs to check their Gmail for the actual Pibox sender address)
3. User clicks "I'm ready" — setup is complete, never touched again

**Every time after (automatic):**
1. Pibox emails the user about a track
2. Gmail forwards it silently to Library Tracker
3. SendGrid receives the email and passes it to the app's backend
4. Claude reads the email, matches it to a track, proposes a status change
5. A badge appears in the toolbar — user opens Inbox panel, taps Approve or Dismiss
6. Approve → track status updates instantly, activity event logged. Dismiss → nothing changes.

---

## Architecture

```
Pibox notification
  → user's Gmail
  → Gmail filter (one-time) forwards to u_abc123@inbound.librarytracker.app
  → SendGrid Inbound Parse receives email, fires HTTP POST webhook
  → Supabase Edge Function (inbound-email)
      → looks up user by forwarding address
      → loads user's tracks
      → calls Claude API with email + tracks
      → Claude returns: matched track id, proposed status, excerpt
      → writes row to inbox_items table
  → Supabase Realtime notifies frontend
  → Inbox badge appears in toolbar
  → User opens slide-in panel, approves or dismisses
```

**New infrastructure:**
- SendGrid account (free tier — up to 100 inbound emails/day)
- DNS MX record on domain pointing subdomain at SendGrid
- Supabase Edge Function: `inbound-email`
- Two new database tables: `inbox_items`, `user_inbox_addresses`

**Note:** Claude runs on Anthropic's servers via API — users never download or interact with it directly. It is invisible to users.

---

## Database

### `user_inbox_addresses`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid | foreign key to auth.users |
| `address` | text | unique forwarding address per user |
| `activated_at` | timestamptz | set when user clicks "I'm ready" |

### `inbox_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | primary key |
| `user_id` | uuid | foreign key to auth.users |
| `track_id` | uuid | nullable — null if Claude couldn't match |
| `raw_email` | text | full email body for audit trail |
| `sender` | text | e.g. `notifications@pibox.io` |
| `subject` | text | email subject line |
| `excerpt` | text | the quote Claude pulled from the email |
| `proposed_status` | StatusId | what Claude proposes the new status should be |
| `current_status` | StatusId | snapshot of status at time of proposal |
| `state` | enum | `pending` / `approved` / `dismissed` |
| `created_at` | timestamptz | |
| `resolved_at` | timestamptz | nullable — set on approve or dismiss |

---

## Edge Function: `inbound-email`

Triggered by SendGrid webhook on every inbound email.

**Steps:**
1. Parse SendGrid POST payload — extract `to`, `from`, `subject`, `text`
2. Look up `user_inbox_addresses` by `address` = the `to` field — find the matching `user_id`
3. If no user found → return 200 (ignore silently)
4. Load all tracks for that user from Supabase
5. Call Claude API with:
   - The email subject + body
   - The list of tracks (code, title, publisher, current status)
   - Instruction: identify which track this is about, propose a status, quote the relevant excerpt
   - **Note:** the actual Pibox sender address must be confirmed before build and hardcoded into the onboarding filter instructions
6. Parse Claude's response:
   - If match found → insert `inbox_items` row with `state: pending`
   - If no match → insert `inbox_items` row with `track_id: null`, `state: pending`
   - If email is clearly irrelevant (spam, receipts) → insert nothing, return 200
7. Return 200 to SendGrid

**Claude prompt strategy:**
- Include all track codes, titles, publishers, and current statuses
- Ask Claude to return structured JSON: `{ track_id, proposed_status, excerpt, confidence }`
- If confidence is low, still surface the proposal — let the user decide
- Use prompt caching on the system prompt to keep API costs low

---

## UI

### Toolbar

- "Inbox" button in the toolbar
- Red badge showing count of `pending` inbox_items when count > 0
- Clicking opens the slide-in panel (same overlay pattern as the detail drawer)

### Inbox slide-in panel

**Width:** 420px, fixed right, full viewport height. Dim covers the table behind it (same as detail drawer).

**Header:** "Inbox" title + pending count badge + × close button

**Proposal card (matched):**
```
colored dot  |  Track name
             |  Publisher · time ago
             |  "Excerpt from email in italics"
             |  [Current Status → Proposed Status pill]
             |  [Approve]  [Dismiss]
```

**Proposal card (unmatched — Claude couldn't identify the track):**
```
grey dot     |  Subject line
             |  Sender · time ago
             |  "Excerpt from email"
             |  [View full email]  [Dismiss]
```

**Approve flow:**
1. Call `updateTrack(track_id, { status: proposed_status })`
2. Append two activity events to the track:
   - `{ kind: 'email_matched', source: 'email', detail: excerpt }`
   - `{ kind: 'status_change', from: current_status, to: proposed_status, source: 'email' }`
3. Update `inbox_items` row: `state: approved`, `resolved_at: now()`
4. Card removed from panel

**Dismiss flow:**
1. Update `inbox_items` row: `state: dismissed`, `resolved_at: now()`
2. Card removed from panel. No track changes.

**Empty state:**
"No proposals yet. Pibox emails will appear here automatically."

### Onboarding setup (first time user opens Inbox panel)

Shown when `user_inbox_addresses.activated_at` is null.

Three steps displayed in the slide-in panel:
1. Copy your forwarding address (with one-click copy button)
2. Set up a Gmail filter — shows pre-filled From/To/Action fields, with "Open Gmail filters ↗" link
3. "Done — that's it" confirmation step

CTA button: **"I'm ready"** — sets `activated_at`, dismisses setup, shows empty inbox state.

---

## Component structure

```
src/components/InboxDrawer/
  index.tsx          — drawer shell, fetches inbox_items, open/close logic
  ProposalCard.tsx   — individual proposal card (matched or unmatched)
  InboxSetup.tsx     — onboarding 3-step setup flow

supabase/functions/
  inbound-email/
    index.ts         — Edge Function entry point
```

**Modified files:**
- `src/components/Toolbar/index.tsx` — add Inbox button + badge
- `src/lib/tracks.ts` — add `approveProposal(itemId, trackId, proposedStatus)` helper
- `src/types/track.ts` — add `InboxItem` type

---

## Verification

1. User opens Inbox for first time → setup panel shown with forwarding address
2. User clicks "I'm ready" → setup dismissed, empty inbox state shown
3. Forwarded email arrives → Edge Function runs, `inbox_items` row created
4. Badge appears in toolbar within seconds (Supabase Realtime)
5. User opens panel → proposal card shown with correct track, excerpt, status change
6. User clicks Approve → track status updates in table, two activity events logged, card disappears
7. User clicks Dismiss → card disappears, track unchanged
8. Unmatched email → card shown with subject + excerpt, no approve button
9. All proposals resolved → empty state shown

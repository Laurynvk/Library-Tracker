# Session 5 — Inbox Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an inbox integration that receives forwarded Pibox notification emails via SendGrid, uses Claude to match them to tracks and propose status changes, and surfaces those proposals in a slide-in inbox panel in the UI.

**Architecture:** SendGrid Inbound Parse receives forwarded emails and fires a webhook to a Supabase Edge Function. The function calls Claude to match the email to a track and propose a status, then writes an `inbox_items` row. The frontend subscribes to new rows via Supabase Realtime and shows proposal cards in a slide-in drawer. The user approves or dismisses — approve updates the track status and logs activity events.

**Tech Stack:** React 19, TypeScript, Supabase (Postgres + Edge Functions + Realtime), Claude API (claude-haiku-4-5-20251001 for cost efficiency), SendGrid Inbound Parse, Vite

---

## File Structure

**New files:**
- `supabase/functions/inbound-email/index.ts` — Edge Function: receives SendGrid webhook, calls Claude, writes inbox_items
- `src/components/InboxDrawer/index.tsx` — drawer shell: open/close, fetches inbox_items, Realtime subscription
- `src/components/InboxDrawer/ProposalCard.tsx` — single proposal card (matched + unmatched variants)
- `src/components/InboxDrawer/InboxSetup.tsx` — 3-step onboarding flow shown before activation
- `src/lib/inbox.ts` — fetchInboxItems, approveProposal, dismissProposal, fetchOrCreateInboxAddress

**Modified files:**
- `src/types/track.ts` — add `InboxItem` type
- `src/components/Toolbar/index.tsx` — add `onInboxOpen` prop + red badge on Inbox button
- `src/App.tsx` — add `inboxOpen` state, pending count, render InboxDrawer

---

## Task 1: Database tables

Create two new tables in the Supabase dashboard.

**Files:**
- No code files — run SQL in Supabase dashboard SQL editor

- [ ] **Step 1: Create `user_inbox_addresses` table**

Open Supabase dashboard → SQL Editor → New query. Run:

```sql
create table user_inbox_addresses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  address text not null unique,
  activated_at timestamptz
);

alter table user_inbox_addresses enable row level security;

create policy "Users can read own address"
  on user_inbox_addresses for select
  using (auth.uid() = user_id);

create policy "Users can update own address"
  on user_inbox_addresses for update
  using (auth.uid() = user_id);

create policy "Users can insert own address"
  on user_inbox_addresses for insert
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Create `inbox_items` table**

```sql
create type inbox_item_state as enum ('pending', 'approved', 'dismissed');

create table inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid references tracks(id) on delete set null,
  raw_email text not null,
  sender text not null,
  subject text not null,
  excerpt text not null,
  proposed_status text,
  current_status text,
  state inbox_item_state not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table inbox_items enable row level security;

create policy "Users can read own inbox items"
  on inbox_items for select
  using (auth.uid() = user_id);

create policy "Users can update own inbox items"
  on inbox_items for update
  using (auth.uid() = user_id);

-- Edge Function inserts rows on behalf of users (service role bypasses RLS)
```

- [ ] **Step 3: Enable Realtime on inbox_items**

In Supabase dashboard → Database → Replication → enable `inbox_items` table for Realtime.

- [ ] **Step 4: Verify tables exist**

In Supabase dashboard → Table Editor — confirm both tables appear with correct columns.

---

## Task 2: Add InboxItem type + inbox lib

**Files:**
- Modify: `src/types/track.ts`
- Create: `src/lib/inbox.ts`

- [ ] **Step 1: Add InboxItem type to `src/types/track.ts`**

Add at the end of the file:

```ts
export type InboxItemState = 'pending' | 'approved' | 'dismissed';

export type InboxItem = {
  id: string;
  user_id: string;
  track_id: string | null;
  raw_email: string;
  sender: string;
  subject: string;
  excerpt: string;
  proposed_status: StatusId | null;
  current_status: StatusId | null;
  state: InboxItemState;
  created_at: string;
  resolved_at: string | null;
};
```

- [ ] **Step 2: Create `src/lib/inbox.ts`**

```ts
import { supabase } from './supabase';
import { updateTrack } from './tracks';
import type { InboxItem, StatusId, ActivityEvent } from '../types/track';

export async function fetchOrCreateInboxAddress(userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('user_inbox_addresses')
    .select('address')
    .eq('user_id', userId)
    .single();

  if (existing) return existing.address;

  const slug = Math.random().toString(36).slice(2, 10);
  const address = `u_${slug}@inbound.librarytracker.app`;

  const { error } = await supabase
    .from('user_inbox_addresses')
    .insert({ user_id: userId, address });

  if (error) throw error;
  return address;
}

export async function activateInbox(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_inbox_addresses')
    .update({ activated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function fetchInboxAddress(userId: string): Promise<{ address: string; activated_at: string | null } | null> {
  const { data } = await supabase
    .from('user_inbox_addresses')
    .select('address, activated_at')
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function fetchPendingItems(userId: string): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from('inbox_items')
    .select('*')
    .eq('user_id', userId)
    .eq('state', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InboxItem[];
}

export async function approveProposal(item: InboxItem): Promise<void> {
  if (!item.track_id || !item.proposed_status) throw new Error('Cannot approve unmatched item');

  const emailEvent: ActivityEvent = {
    at: new Date().toISOString(),
    kind: 'email_matched',
    source: 'email',
    detail: item.excerpt,
  };
  const statusEvent: ActivityEvent = {
    at: new Date().toISOString(),
    kind: 'status_change',
    from: item.current_status ?? undefined,
    to: item.proposed_status,
    source: 'email',
  };

  const { data: track, error: fetchError } = await supabase
    .from('tracks')
    .select('activity')
    .eq('id', item.track_id)
    .single();
  if (fetchError) throw fetchError;

  const updatedActivity = [...(track.activity ?? []), emailEvent, statusEvent];

  await updateTrack(item.track_id, {
    status: item.proposed_status as StatusId,
    activity: updatedActivity,
  });

  const { error } = await supabase
    .from('inbox_items')
    .update({ state: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', item.id);
  if (error) throw error;
}

export async function dismissProposal(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('inbox_items')
    .update({ state: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw error;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add library-tracker/src/types/track.ts library-tracker/src/lib/inbox.ts
git commit -m "feat: add InboxItem type and inbox lib functions"
```

---

## Task 3: Supabase Edge Function

**Files:**
- Create: `supabase/functions/inbound-email/index.ts`

- [ ] **Step 1: Install Supabase CLI (if not already installed)**

```bash
brew install supabase/tap/supabase
```

Verify: `supabase --version` — should print a version number.

- [ ] **Step 2: Initialise Supabase in the project root**

```bash
cd /Users/laurynvk/Documents/ClaudeProjects/LibraryTracker
supabase init
```

This creates a `supabase/` directory with config.

- [ ] **Step 3: Link to the remote Supabase project**

```bash
supabase link
```

Follow the prompt — select your existing project. You'll need the project reference ID from the Supabase dashboard URL (e.g. `https://app.supabase.com/project/YOUR_REF`).

- [ ] **Step 4: Create the Edge Function file**

```bash
supabase functions new inbound-email
```

This creates `supabase/functions/inbound-email/index.ts`.

- [ ] **Step 5: Write the Edge Function**

Replace the contents of `supabase/functions/inbound-email/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.52.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });

  // SendGrid posts multipart/form-data
  const formData = await req.formData();
  const to = formData.get('to') as string;
  const from = formData.get('from') as string;
  const subject = formData.get('subject') as string;
  const text = (formData.get('text') as string) ?? '';

  if (!to || !from) return new Response('ok', { status: 200 });

  // Extract the bare address from "Name <addr>" format
  const toAddress = to.match(/<(.+?)>/)?.[1] ?? to.trim();

  // Look up user by forwarding address
  const { data: addrRow } = await supabase
    .from('user_inbox_addresses')
    .select('user_id')
    .eq('address', toAddress)
    .single();

  if (!addrRow) return new Response('ok', { status: 200 });

  const userId = addrRow.user_id;

  // Load user's tracks
  const { data: tracks } = await supabase
    .from('tracks')
    .select('id, code, title, publisher, status')
    .eq('user_id', userId);  // NOTE: tracks table must have user_id column — see note below

  const trackList = (tracks ?? []).map((t: { id: string; code: string | null; title: string; publisher: string | null; status: string }) =>
    `- id:${t.id} | code:${t.code ?? '?'} | title:${t.title} | publisher:${t.publisher ?? '?'} | status:${t.status}`
  ).join('\n');

  // Ask Claude to match and propose
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: `You are an assistant for a music library tracker app. Given an email and a list of tracks, identify which track the email is about and propose a status update. Return ONLY valid JSON with this shape:
{
  "track_id": "<uuid or null>",
  "proposed_status": "<one of: brief|writing|written|revising|needs_rev|sent|approved|delivered|hold|rejected|null>",
  "excerpt": "<the 1-2 sentence quote from the email that led to your decision>",
  "relevant": <true if this email is about a track, false if it is spam or unrelated>
}`,
    messages: [{
      role: 'user',
      content: `Email subject: ${subject}\n\nEmail body:\n${text.slice(0, 2000)}\n\nTracks:\n${trackList}`,
    }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text.trim();

  let parsed: { track_id: string | null; proposed_status: string | null; excerpt: string; relevant: boolean };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response('ok', { status: 200 });
  }

  if (!parsed.relevant) return new Response('ok', { status: 200 });

  // Look up current status for the matched track
  let currentStatus: string | null = null;
  if (parsed.track_id) {
    const match = (tracks ?? []).find((t: { id: string; status: string }) => t.id === parsed.track_id);
    currentStatus = match?.status ?? null;
  }

  await supabase.from('inbox_items').insert({
    user_id: userId,
    track_id: parsed.track_id ?? null,
    raw_email: text.slice(0, 10000),
    sender: from,
    subject,
    excerpt: parsed.excerpt,
    proposed_status: parsed.proposed_status ?? null,
    current_status: currentStatus,
    state: 'pending',
  });

  return new Response('ok', { status: 200 });
});
```

> **Note on `user_id` on tracks:** The current `tracks` table may not have a `user_id` column if the app is single-user. If so, remove the `.eq('user_id', userId)` filter from the tracks query for now — all tracks belong to the one user. Add `user_id` to tracks when multi-user support is added.

- [ ] **Step 6: Set Edge Function secrets**

```bash
supabase secrets set ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase at runtime — do not set them manually.

- [ ] **Step 7: Deploy the Edge Function**

```bash
supabase functions deploy inbound-email --no-verify-jwt
```

`--no-verify-jwt` is required because SendGrid hits the webhook without a Supabase auth token.

Expected output: function URL printed, e.g. `https://YOUR_REF.supabase.co/functions/v1/inbound-email`

- [ ] **Step 8: Test the Edge Function with curl**

```bash
curl -X POST https://YOUR_REF.supabase.co/functions/v1/inbound-email \
  -F "to=u_testaddr@inbound.librarytracker.app" \
  -F "from=notifications@pibox.com" \
  -F "subject=Feedback on Midnight Drive" \
  -F "text=Hi, we have two notes on the second verse — can you tighten the arrangement? Thanks"
```

Expected: `ok` response, and a new row in `inbox_items` visible in the Supabase dashboard.

- [ ] **Step 9: Commit**

```bash
git add supabase/
git commit -m "feat: add inbound-email Edge Function"
```

---

## Task 4: SendGrid configuration

Manual infrastructure setup — no code files.

- [ ] **Step 1: Create a free SendGrid account**

Go to https://sendgrid.com and sign up for the free tier.

- [ ] **Step 2: Add and verify your domain**

In SendGrid dashboard → Settings → Sender Authentication → Authenticate a Domain. Follow the steps to add DNS records for `librarytracker.app` (or your actual domain). SendGrid will give you CNAME records to add via your domain registrar (Vercel Domains, Namecheap, etc.).

- [ ] **Step 3: Set up Inbound Parse**

In SendGrid dashboard → Settings → Inbound Parse → Add Host & URL:
- Hostname: `inbound.librarytracker.app` (this is the subdomain emails will be sent to)
- URL: `https://YOUR_REF.supabase.co/functions/v1/inbound-email`
- Check "POST the raw, full MIME message" — OFF (we want form-encoded)

- [ ] **Step 4: Add MX record**

At your domain registrar, add this DNS record:
- Type: MX
- Host: `inbound` (subdomain)
- Value: `mx.sendgrid.net`
- Priority: 10

- [ ] **Step 5: Test with a real forwarded email**

Send a test email from `notifications@pibox.com` (or forward one manually) to any `*@inbound.librarytracker.app` address. Check the Supabase `inbox_items` table for a new row.

---

## Task 5: InboxSetup component

**Files:**
- Create: `src/components/InboxDrawer/InboxSetup.tsx`

- [ ] **Step 1: Create `src/components/InboxDrawer/InboxSetup.tsx`**

```tsx
import { useState } from 'react';
import { THEME } from '../../lib/theme';

type Props = {
  address: string;
  onReady: () => void;
};

export function InboxSetup({ address, onReady }: Props) {
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const gmailFilterUrl =
    `https://mail.google.com/mail/u/0/#create-filter` +
    `?from=notifications%40pibox.com` +
    `&to=${encodeURIComponent(address)}`;

  const stepStyle: React.CSSProperties = {
    background: THEME.surfaceAlt,
    border: `1px solid ${THEME.border}`,
    borderRadius: 6,
    padding: '12px 14px',
  };

  const numberStyle: React.CSSProperties = {
    background: THEME.accent,
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: THEME.ink,
    marginBottom: 6,
  };

  return (
    <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', flex: 1 }}>
      <p style={{ fontSize: 12, color: THEME.inkSoft, lineHeight: 1.6, margin: 0 }}>
        When Pibox emails you about a track, Library Tracker can read it and propose a status update automatically.
      </p>

      {/* Step 1 */}
      <div style={stepStyle}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <div style={numberStyle}>1</div>
          <div style={labelStyle}>Copy your forwarding address</div>
        </div>
        <div style={{
          background: THEME.bg,
          border: `1px solid ${THEME.border}`,
          borderRadius: 4,
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 11, fontFamily: THEME.mono, color: THEME.accent, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {address}
          </span>
          <button
            onClick={copyAddress}
            style={{
              background: THEME.surfaceAlt,
              border: `1px solid ${THEME.border}`,
              borderRadius: 4,
              padding: '3px 10px',
              fontSize: 11,
              color: copied ? THEME.accent : THEME.inkSoft,
              cursor: 'pointer',
              fontFamily: THEME.sans,
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Step 2 */}
      <div style={stepStyle}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <div style={numberStyle}>2</div>
          <div style={labelStyle}>Set up a Gmail filter</div>
        </div>
        <p style={{ fontSize: 11, color: THEME.inkMuted, margin: '0 0 8px', lineHeight: 1.6 }}>
          In Gmail: Settings → Filters → Create new filter
        </p>
        <div style={{
          background: THEME.bg,
          border: `1px solid ${THEME.border}`,
          borderRadius: 4,
          padding: '8px 10px',
          fontSize: 11,
          lineHeight: 2,
          fontFamily: THEME.mono,
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ color: THEME.inkMuted, minWidth: 28 }}>From</span>
            <span style={{ color: THEME.ink }}>notifications@pibox.com</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ color: THEME.inkMuted, minWidth: 28 }}>To</span>
            <span style={{ color: THEME.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ color: THEME.inkMuted, minWidth: 28 }}>Do</span>
            <span style={{ color: THEME.ink }}>Forward to this address</span>
          </div>
        </div>
        <a
          href={gmailFilterUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 8,
            fontSize: 11,
            color: '#5a7fb0',
            textDecoration: 'none',
          }}
        >
          Open Gmail filters ↗
        </a>
      </div>

      {/* Step 3 */}
      <div style={stepStyle}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
          <div style={numberStyle}>3</div>
          <div style={labelStyle}>Done — that's it</div>
        </div>
        <p style={{ fontSize: 11, color: THEME.inkMuted, margin: 0, lineHeight: 1.6 }}>
          Next time Pibox emails you, it'll appear here as a proposal. You approve or dismiss — Library Tracker does the rest.
        </p>
      </div>

      <button
        onClick={onReady}
        style={{
          background: THEME.accent,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '10px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: THEME.sans,
          marginTop: 4,
        }}
      >
        I'm ready
      </button>
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
git add library-tracker/src/components/InboxDrawer/InboxSetup.tsx
git commit -m "feat: add InboxSetup onboarding component"
```

---

## Task 6: ProposalCard component

**Files:**
- Create: `src/components/InboxDrawer/ProposalCard.tsx`

- [ ] **Step 1: Create `src/components/InboxDrawer/ProposalCard.tsx`**

```tsx
import { useState } from 'react';
import { THEME, statusById, fmtDate } from '../../lib/theme';
import type { InboxItem } from '../../types/track';

type Props = {
  item: InboxItem;
  onApprove: (item: InboxItem) => Promise<void>;
  onDismiss: (itemId: string) => Promise<void>;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return fmtDate(iso);
}

export function ProposalCard({ item, onApprove, onDismiss }: Props) {
  const [loading, setLoading] = useState<'approve' | 'dismiss' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMatched = item.track_id !== null && item.proposed_status !== null;
  const proposedStatus = item.proposed_status ? statusById(item.proposed_status) : null;
  const currentStatus = item.current_status ? statusById(item.current_status) : null;
  const dotColor = proposedStatus?.color ?? THEME.inkMuted;

  async function handleApprove() {
    setLoading('approve');
    setError(null);
    try {
      await onApprove(item);
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  }

  async function handleDismiss() {
    setLoading('dismiss');
    setError(null);
    try {
      await onDismiss(item.id);
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  }

  const btnBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 4,
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 500,
    cursor: loading ? 'default' : 'pointer',
    fontFamily: THEME.sans,
    opacity: loading ? 0.6 : 1,
  };

  return (
    <div style={{
      background: THEME.surface,
      border: `1px solid ${THEME.border}`,
      borderLeft: `3px solid ${dotColor}`,
      borderRadius: 5,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: THEME.ink }}>
          {isMatched ? item.subject.replace(/^(Re:|Fwd:)\s*/i, '') : item.subject}
        </span>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 10, color: THEME.inkMuted }}>
        {item.sender} · {relativeTime(item.created_at)}
      </div>

      {/* Excerpt */}
      <div style={{ fontSize: 11, color: THEME.inkSoft, fontStyle: 'italic', lineHeight: 1.5 }}>
        "{item.excerpt}"
      </div>

      {/* Status change pill */}
      {isMatched && currentStatus && proposedStatus && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: THEME.surfaceAlt,
          border: `1px solid ${THEME.border}`,
          borderRadius: 4,
          padding: '3px 8px',
          fontSize: 10,
          color: THEME.inkSoft,
          alignSelf: 'flex-start',
        }}>
          <span style={{ color: currentStatus.color }}>{currentStatus.label}</span>
          <span style={{ color: THEME.inkMuted }}>→</span>
          <span style={{ color: proposedStatus.color, fontWeight: 600 }}>{proposedStatus.label}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        {isMatched && (
          <button
            onClick={handleApprove}
            disabled={loading !== null}
            style={{ ...btnBase, background: THEME.accent, color: '#fff', flex: 1 }}
          >
            {loading === 'approve' ? 'Approving…' : 'Approve'}
          </button>
        )}
        <button
          onClick={handleDismiss}
          disabled={loading !== null}
          style={{ ...btnBase, background: THEME.surfaceAlt, border: `1px solid ${THEME.border}`, color: THEME.inkSoft }}
        >
          {loading === 'dismiss' ? '…' : 'Dismiss'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 10, color: '#c44545', marginTop: 2 }}>{error}</div>
      )}
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
git add library-tracker/src/components/InboxDrawer/ProposalCard.tsx
git commit -m "feat: add ProposalCard component"
```

---

## Task 7: InboxDrawer shell

**Files:**
- Create: `src/components/InboxDrawer/index.tsx`

- [ ] **Step 1: Create `src/components/InboxDrawer/index.tsx`**

```tsx
import { useEffect, useState, useCallback } from 'react';
import { THEME } from '../../lib/theme';
import {
  fetchOrCreateInboxAddress,
  fetchInboxAddress,
  activateInbox,
  fetchPendingItems,
  approveProposal,
  dismissProposal,
} from '../../lib/inbox';
import { supabase } from '../../lib/supabase';
import { InboxSetup } from './InboxSetup';
import { ProposalCard } from './ProposalCard';
import type { InboxItem } from '../../types/track';

type Props = {
  userId: string;
  onClose: () => void;
  onPendingCountChange: (count: number) => void;
};

type InboxState = 'loading' | 'setup' | 'active';

export function InboxDrawer({ userId, onClose, onPendingCountChange }: Props) {
  const [state, setState] = useState<InboxState>('loading');
  const [address, setAddress] = useState('');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const pending = await fetchPendingItems(userId);
      setItems(pending);
      onPendingCountChange(pending.length);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [userId, onPendingCountChange]);

  useEffect(() => {
    async function init() {
      try {
        const addr = await fetchOrCreateInboxAddress(userId);
        setAddress(addr);
        const row = await fetchInboxAddress(userId);
        if (row?.activated_at) {
          setState('active');
          await loadItems();
        } else {
          setState('setup');
        }
      } catch (e) {
        setError((e as Error).message);
        setState('active');
      }
    }
    init();
  }, [userId, loadItems]);

  // Realtime subscription
  useEffect(() => {
    if (state !== 'active') return;
    const channel = supabase
      .channel('inbox-items')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'inbox_items',
        filter: `user_id=eq.${userId}`,
      }, () => {
        loadItems();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [state, userId, loadItems]);

  async function handleReady() {
    await activateInbox(userId);
    setState('active');
    await loadItems();
  }

  async function handleApprove(item: InboxItem) {
    await approveProposal(item);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    onPendingCountChange(items.length - 1);
  }

  async function handleDismiss(itemId: string) {
    await dismissProposal(itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    onPendingCountChange(items.length - 1);
  }

  return (
    <>
      {/* Dim */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(31,27,22,0.28)',
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420,
        background: THEME.surface,
        borderLeft: `1px solid ${THEME.border}`,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: THEME.sans,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 16px',
          borderBottom: `1px solid ${THEME.border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: THEME.ink }}>Inbox</span>
          {items.length > 0 && (
            <span style={{
              background: THEME.accent, color: '#fff',
              fontSize: 10, fontWeight: 700,
              padding: '1px 7px', borderRadius: 10,
              marginLeft: 8,
            }}>
              {items.length}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              fontSize: 18, color: THEME.inkMuted,
              cursor: 'pointer', lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        {state === 'loading' && (
          <div style={{ padding: 20, color: THEME.inkMuted, fontSize: 12 }}>Loading…</div>
        )}

        {state === 'setup' && (
          <InboxSetup address={address} onReady={handleReady} />
        )}

        {state === 'active' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {error && (
              <div style={{ fontSize: 11, color: '#c44545' }}>{error}</div>
            )}
            {items.length === 0 && !error && (
              <div style={{ fontSize: 12, color: THEME.inkMuted, marginTop: 16, textAlign: 'center', lineHeight: 1.7 }}>
                No proposals yet.<br />
                Pibox emails will appear here automatically.
              </div>
            )}
            {items.map((item) => (
              <ProposalCard
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </>
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
git add library-tracker/src/components/InboxDrawer/
git commit -m "feat: add InboxDrawer shell with setup and proposal list"
```

---

## Task 8: Wire up Toolbar and App

**Files:**
- Modify: `src/components/Toolbar/index.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update Toolbar props and badge**

In `src/components/Toolbar/index.tsx`, add two props and update the Inbox button:

```tsx
// Add to Props type:
type Props = {
  trackCount: number;
  search: string;
  onSearch: (v: string) => void;
  filterStatus: string;
  onFilterStatus: (v: string) => void;
  filterInvoice: string;
  onFilterInvoice: (v: string) => void;
  inboxPendingCount: number;       // ← new
  onInboxOpen: () => void;         // ← new
};
```

Replace the existing Inbox button (the `<button>` containing the envelope SVG and "Inbox" text) with:

```tsx
<button
  onClick={onInboxOpen}
  style={{
    position: 'relative',
    padding: '7px 12px',
    background: 'transparent',
    color: THEME.inkSoft,
    border: `1px solid ${THEME.border}`,
    borderRadius: 6,
    fontSize: 12.5, fontWeight: 500,
    cursor: 'pointer', fontFamily: THEME.sans,
    display: 'flex', alignItems: 'center', gap: 6,
  }}
>
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M2 4l4.5 3.5L11 4M2 3h9v7H2z" />
  </svg>
  Inbox
  {inboxPendingCount > 0 && (
    <span style={{
      position: 'absolute',
      top: -5, right: -5,
      background: THEME.accent,
      color: '#fff',
      fontSize: 9,
      fontWeight: 700,
      minWidth: 16, height: 16,
      borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 4px',
    }}>
      {inboxPendingCount}
    </span>
  )}
</button>
```

- [ ] **Step 2: Update App.tsx**

Add inbox state and wire up the drawer. Add these imports at the top:

```tsx
import { InboxDrawer } from './components/InboxDrawer';
```

Add these state variables inside `App()`:

```tsx
const [inboxOpen, setInboxOpen] = useState(false);
const [inboxPendingCount, setInboxPendingCount] = useState(0);
```

Update the `<Toolbar>` render to pass the new props:

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
/>
```

Add the InboxDrawer just before the closing `</div>` of the root element, after `<TrackDrawer>`:

```tsx
{inboxOpen && (
  <InboxDrawer
    userId="PLACEHOLDER_USER_ID"
    onClose={() => setInboxOpen(false)}
    onPendingCountChange={setInboxPendingCount}
  />
)}
```

> **Note on userId:** The app currently has no auth — it connects to Supabase with the anon key as a single user. For now, hardcode the user's UUID from the Supabase dashboard (Authentication → Users → copy your user id). Multi-user auth is a Phase 3 concern.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd library-tracker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the dev server and test manually**

```bash
cd library-tracker && npm run dev
```

Check:
1. Inbox button appears in toolbar
2. Clicking Inbox opens the drawer (dims table behind it)
3. First open shows the 3-step setup flow
4. "I'm ready" button dismisses setup and shows empty state
5. Clicking the dim or × closes the drawer

- [ ] **Step 5: Commit**

```bash
git add library-tracker/src/components/Toolbar/index.tsx library-tracker/src/App.tsx
git commit -m "feat: wire up InboxDrawer to Toolbar and App"
```

---

## Task 9: End-to-end verification

- [ ] **Step 1: Send a test email through the full pipeline**

Forward a real Pibox notification email (or a test email from `notifications@pibox.com`) to your forwarding address at `u_YOUR_SLUG@inbound.librarytracker.app`.

- [ ] **Step 2: Verify the Edge Function ran**

In Supabase dashboard → Edge Functions → `inbound-email` → Logs — confirm the function was invoked with no errors.

- [ ] **Step 3: Verify the inbox_items row**

In Supabase dashboard → Table Editor → `inbox_items` — confirm a new row with `state: pending` and correct `track_id`, `excerpt`, `proposed_status`.

- [ ] **Step 4: Verify the UI badge appears**

With the dev server running, the Inbox badge should appear on the toolbar (via Realtime). If it doesn't appear automatically, refresh the page — the badge should show on load.

- [ ] **Step 5: Approve a proposal**

Open the inbox panel, click Approve on the proposal. Verify:
- Card disappears from inbox
- Track row in table shows updated status
- Track's activity feed (open detail drawer) shows `email_matched` and `status_change` events

- [ ] **Step 6: Dismiss a proposal**

Send another test email, open inbox, click Dismiss. Verify:
- Card disappears
- Track status unchanged
- `inbox_items` row has `state: dismissed`

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete Session 5 inbox integration"
```

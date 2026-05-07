# Library Tracker — Product Requirements Document

**Version:** 1.0  
**Date:** May 2026  
**Author:** Lauryn (LL)  
**Status:** Draft

---

## 1. Executive Summary

**Product:** Library Tracker — a project management tool for library music composers.

**Problem:** Library composers juggle 6–20 active tracks across multiple publishers simultaneously. Today they manage this with spreadsheets — no automation, no connection to their inbox, no filesystem integration. Every status update, folder creation, and invoice note gets typed manually, twice.

**Solution:** Library Tracker replaces the spreadsheet with a tool that reads briefs automatically, generates project codes and folder structures, and monitors your inbox to propose status updates — so you can focus on making music, not managing admin.

**Stage:** Pre-launch. Founder-as-user validation in progress. Built to work for one person first, then expand to the broader community of library composers and adjacent creative professionals.

**Goal:** Reach 1,000 paying subscribers by end of Year 1 through community-driven growth in the library music space, then expand to adjacent segments (TV/film composers, sync agencies) in Year 2.

---

## 2. Problem Statement

### The job to be done

> "When a brief comes in, generate the project code, capture the metadata, create the desktop folder, and keep the track's status in sync with what's happening in my inbox — without me having to type anything twice."

### The current workflow (the "before state")

1. Brief arrives via email (PDF, screenshot, or Google Doc link)
2. Composer reads it, manually extracts: title, album, publisher, fee, due date
3. Opens spreadsheet, creates a new row, types everything in
4. Manually creates a folder on the Desktop with the project's naming convention
5. Sends demo, manually updates the spreadsheet row
6. Publisher emails back with revisions — composer has to remember to check and update
7. Invoice sent, manually noted; payment received, manually updated

**What breaks:** Spreadsheets don't read emails. Folders don't name themselves. Status gets stale. Invoices get forgotten. Nothing is connected to anything else.

### Why now

AI tools have made brief parsing, email classification, and structured data extraction cheap and reliable. The technical barriers that made this tool impractical three years ago no longer exist.

---

## 3. Market Opportunity

### Honest sizing

This is a niche market. That is not a problem — it is a positioning advantage. Niche SaaS is profitable, and underserved niches convert better than crowded ones.

| Segment | Size (est.) |
|---------|------------|
| TAM — all professional/semi-professional composers | ~1M+ worldwide |
| SAM — library/sync composers who regularly receive briefs | ~80,000–150,000 worldwide |
| SOM (Year 1–2 target) — English-speaking, tech-comfortable, reachable via community | ~5,000–15,000 |

**Revenue model validation:**

| Users | Monthly Revenue | ARR |
|-------|---------------|-----|
| 500 paying | $7,000 | $84K |
| 1,000 paying | $14,000 | $168K |
| 3,000 paying | $42,000 | $504K |

These are real, achievable milestones for a solo-to-small-team operation. Library Tracker does not need to be a billion-dollar company to be a great business.

### Expansion path

The core workflow — receive brief → create project → track status → invoice — is not unique to library composers.

| Segment | Adjacent use case | When to expand |
|---------|------------------|----------------|
| TV/Film composers | Same brief-to-delivery flow, longer timelines | Phase 2 |
| Jingle/advertising composers | High volume, fast turnaround | Phase 2 |
| Sync music supervisors | Track briefs from the *other side* | Phase 3 |
| Sound designers, voice actors | File delivery + invoice tracking | Phase 3 |

**Important:** Do not try to serve all of these in v1. Nail the library composer workflow first. Expansion comes from serving the core user so well that adjacent users ask for it. Expanding the positioning too early ("project management for creatives") converts worse than a specific, searchable niche.

---

## 4. Target Customer

### Primary ICP — v1

| Attribute | Profile |
|-----------|---------|
| Role | Independent library/sync composer |
| Publisher relationships | 2–5 active publishers simultaneously |
| Active tracks | 6–20 at any time |
| Publishers | APM, Position Music, Extreme Music, Sony PM, Warner Chappell PM, Universal Production Music |
| Current tool | Google Sheets or Excel |
| Pain level | High — doing all of this manually, every day |
| Willingness to pay | Moderate-high — composers regularly pay $15–30/mo for DAW plugins and sample libraries |
| Where they live | Facebook groups ("Library Music Composers"), Discord servers, YouTube channels (MÄKR, Alex Mason, etc.), SoundBetter |

### Secondary ICP — Phase 2

TV/Film composers and advertising producers who receive briefs but have more complex delivery requirements (stems, sync licenses, multiple versions).

### Tertiary — Phase 3

Sync agencies and music supervisors who issue briefs and need to track delivery from their side. This is a distinct buyer persona with potentially higher willingness to pay (B2B).

---

## 5. Value Propositions

### Core message

> **"Your library music spreadsheet — but it reads your briefs, names your folders, and watches your inbox."**

### The three unfair advantages

**1. One drop to a full project**
Upload a PDF brief or paste a link. The app reads it, suggests a project code, fills in all the metadata, and creates the desktop folder structure. What used to take 10 minutes takes under 60 seconds.

**2. Your inbox becomes a status tracker**
Emails from publishers get matched to tracks automatically. The app reads them and proposes a status update ("Needs revision — mentions 'two notes on the second verse'"). One tap to approve. No more stale spreadsheet rows.

**3. Everything named consistently, always**
Project codes, folder names, and file conventions follow your own template. No typos, no "wait, was it v1.00 or v1?", no folders named wrong.

---

## 6. Feature Priorities

### Phase 1 — Web App (Founder Validation, Months 0–3)

**Goal:** Prove the core loop works. Replace the spreadsheet for the founder.

| Feature | Priority |
|---------|----------|
| Track table — sortable, filterable, all status/invoice/fee fields | Must have |
| Brief upload — drag PDF/image/link → AI parses → confirm → folder structure | Must have |
| Project code generation from user-defined template | Must have |
| Folder zip download (web fallback — no desktop app required yet) | Must have |
| Invoice badge cycling (Unpaid → Invoiced → Paid) | Must have |
| Detail drawer with inline editing and activity feed | Must have |
| Tweaks panel (theme, density, code format, status pipeline, folder template) | Must have |
| localStorage persistence (single device) | Must have |
| Two visual variants (Warm Paper / Studio Console) | Nice to have |

**Success signal:** Founder stops using their spreadsheet.

### Phase 2 — Desktop Shell + Inbox (Early Beta, Months 3–6)

**Goal:** Make the "aha moment" real. Ship to 20–50 beta users.

| Feature | Priority |
|---------|----------|
| Electron or Tauri wrapper with real folder creation on disk | Must have |
| iCloud/Dropbox sync (state file in user's sync folder) | Must have |
| Email inbox integration via forwarding address (no OAuth required — see Risk 3) | Must have |
| **CSV import from existing spreadsheet** | Must have — this is the #1 onboarding lever |
| AI email status proposals in Inbox panel | Must have |
| Auto-approve trusted senders | Nice to have |
| CSV export (users should never feel locked in) | Must have |

**Success signal:** 20+ beta users who replaced their spreadsheet and report using it weekly.

### Phase 3 — Cloud Backend (Scale, Months 6–18)

**Goal:** Multi-device, multi-user, subscription revenue engine.

| Feature | Priority |
|---------|----------|
| Postgres backend + auth (Supabase recommended) | Must have |
| Gmail OAuth integration (once 200+ active users, see Risk 3) | Must have |
| Outlook integration | Must have |
| Team/studio accounts | Must have |
| Analytics: delivery rate by publisher, outstanding invoices, time-to-delivery | Nice to have |
| API for power users | Nice to have |
| Mobile (read-only at minimum) | Nice to have |

---

## 7. Business Model

### Recommendation: Freemium with a clear Pro gate

The freemium model works here because:
- The free tier needs to be genuinely better than a spreadsheet so people adopt it
- The Pro features (email integration, real folder creation, unlimited tracks) are the daily-value features that justify a subscription

### Pricing tiers

| Feature | Free | Pro ($14/mo or $130/yr) | Studio ($28/mo — future) |
|---------|------|------------------------|--------------------------|
| Active tracks | Up to 10 | Unlimited | Unlimited |
| Brief upload + AI parsing | ✓ | ✓ | ✓ |
| Project code generation | ✓ | ✓ | ✓ |
| Folder download (zip) | ✓ | ✓ | ✓ |
| Status + invoice tracking | ✓ | ✓ | ✓ |
| Real folder creation on desktop | — | ✓ | ✓ |
| Email inbox integration | — | ✓ | ✓ |
| AI email status proposals | — | ✓ | ✓ |
| iCloud/Dropbox sync | — | ✓ | ✓ |
| CSV import | — | ✓ | ✓ |
| CSV export | ✓ | ✓ | ✓ |
| Multiple users | — | — | ✓ |
| Shared track library | — | — | ✓ |

### Why 10 tracks is the free limit

A composer just starting out typically has 3–5 active tracks. The free tier is genuinely useful to them. An established composer working with multiple publishers will hit 10 quickly — that is the natural conversion trigger.

### AI cost management

Brief parsing and email inference add per-user API costs. Estimate: ~$0.02–0.05 per brief parse, ~$0.01 per email inference. At $14/month with moderate usage (5 briefs/month, 20 emails/month), AI costs are under $0.50/user/month — well within margin. Monitor per-user spend and introduce soft rate limits if needed.

---

## 8. The Three Risks — and How to Solve Them

### Risk 1: The market is small

**The concern:** Library composers are a niche. If growth is slow, you hit a revenue ceiling before the business is sustainable.

**How to solve it:**

First, define the ceiling honestly. If there are 80,000 library composers worldwide and you reach 2% as paying users: 1,600 × $14/mo = $268K ARR. That is a sustainable solo business. Know whether you are building a lifestyle business or a venture-scale company — both are valid, but they require different decisions.

To grow beyond the core niche:

- **Adjacent segments first.** TV/Film and advertising composers share 90% of the same workflow. Do not rebrand the product — just ensure the code format and folder templates are flexible enough to serve their conventions. These users will find you once the core product is excellent.
- **The "other side" play.** Music supervisors and sync agencies receive briefs from their side. A future "Publisher mode" where agencies track outgoing briefs is a natural Phase 3 expansion with a completely different buyer (B2B, higher willingness to pay, potential for per-seat enterprise pricing).
- **Do not genericize early.** "Track management for creatives" sounds bigger but converts worse. "Library music brief tracker" is searchable, specific, and self-selecting. Expand the positioning only after you have proven product-market fit in the core niche.

### Risk 2: Habit change — "my spreadsheet already works"

**The concern:** Spreadsheets are free, flexible, and already in muscle memory. Asking someone to switch tools requires a strong, immediate reason.

**How to solve it:**

The switch must happen inside a single session. If a new user has to manually re-enter their existing tracks to try the app, most will not.

1. **CSV import is non-negotiable for Phase 2.** Let users upload their existing spreadsheet. Map columns interactively. Their data is there when they first log in. This is the single highest-leverage onboarding feature for reducing switch friction.

2. **Run both in parallel initially.** Do not position Library Tracker as "delete your spreadsheet." Position it as "try it for your next brief." The moment the folder creates itself and the inbox item appears, the comparison is over on its own.

3. **Never lock them in.** Always offer CSV export. Users who feel they can leave at any time stay longer. Users who feel trapped churn and talk about it publicly.

4. **Make the aha moment happen in under 60 seconds.** The brief upload flow — drop PDF → folder created → row appears in the table — must be demonstrably faster and less error-prone than the spreadsheet in the first demo or onboarding video. This video is your most important marketing asset. Record it. Keep it short.

5. **Spreadsheet-style familiarity.** The table is the main view for a reason. The app should feel like a spreadsheet that grew up, not a foreign CRM.

### Risk 3: Gmail OAuth is a real obstacle

**The concern:** Google requires a security review for apps requesting Gmail API access with `gmail.modify` scope. This review can take months, requires a privacy policy, a security assessment, and demonstrated real users — and Google can deny or revoke access at any time. Microsoft Outlook requires the same level of approval for Microsoft Graph.

**How to solve it — a phased approach:**

**Phase 2 (no OAuth required): Unique email forwarding address**

Each user gets a unique forwarding address: `u_abc123@inbox.librarytracker.app`. They set up a Gmail filter (two minutes, one-time setup) to forward emails from publisher domains to this address. Library Tracker receives and processes those emails with zero dependency on Google or Microsoft approval.

- **Pros:** Works immediately, no approval required, privacy-preserving (the app sees only forwarded emails, not the entire inbox), users stay in control
- **Cons:** Minor setup friction, emails are not archived back to Gmail automatically in Phase 2
- **User framing:** "We use a secure forwarding address rather than asking for access to your entire inbox. Takes 2 minutes to set up — here is the Gmail filter to copy." This is a feature, not a workaround.

**Phase 3 (Gmail OAuth, once 200+ active users):**

Apply for Google's Gmail API review with real user data, a published privacy policy, and demonstrated legitimate use. By this point you have the evidence Google requires for approval. The forwarding address continues to work for users who prefer it.

**Phase 3 (Outlook):**

Same pattern — forwarding address first, Microsoft Graph OAuth when scale justifies the review process.

---

## 9. Go-to-Market

### Phase 1: Founder-as-user (Months 0–3)

- Use it exclusively yourself. Fix what is broken. Make the core loop reliable.
- No public launch. No promises.
- Gather personal testimonial data: time saved per brief, errors eliminated, invoices caught.

### Phase 2: Community beta (Months 3–6)

- Post in Facebook groups ("Library Music Composers", "Sync Music for Film & TV"): "I built a tool that replaced my library music spreadsheet — 20 beta spots available"
- Post a 60-second screen recording showing the brief upload → folder creation moment on YouTube Shorts and Instagram Reels
- Offer 3 months Pro free in exchange for detailed feedback sessions
- Target: 20–50 active beta users, 5+ video testimonials
- Validate $14/mo price point with 3 variants on the pricing page

### Phase 3: Public launch (Months 6–12)

- Product Hunt launch (target a Tuesday)
- Posts in r/WeAreTheMusicMakers, r/audioengineering, r/sounddesign
- Reach out to library music YouTube channels (MÄKR, Alex Mason, Lucy Liyou, Ryan Harper) for honest reviews — not sponsored posts
- Referral program: 1 month Pro free per referred paying user who stays 30 days
- SEO targets: "library music project management", "music brief tracker", "sync composer tools", "library composer workflow"

### Phase 4: Partnership and content (Months 12+)

- Approach music libraries directly. APM, Position Music, and similar companies may be interested in co-marketing or sponsored integration (their composers would benefit from the tool)
- Build a free resource: "Library Composer Brief Checklist" as a lead magnet
- Explore affiliate arrangements with composer education platforms and YouTube channels

---

## 10. Success Metrics

| Metric | Definition | Target (Year 1) |
|--------|-----------|-----------------|
| Activation rate | % of signups who complete first brief upload | >60% |
| D7 retention | % of activated users still active after 7 days | >40% |
| Free → Pro conversion | % of free users who upgrade | 8–15% |
| Monthly churn (Pro) | % of Pro subscribers who cancel per month | <5% |
| MRR | Monthly recurring revenue | $5K by Month 12 |
| NPS | Net Promoter Score | >50 |

**North star metric:** Number of briefs processed per week across all users. This measures whether people are using Library Tracker for their real workflow, not just signing up and abandoning it.

---

## 11. Competitive Landscape

| Tool | What it does | Why Library Tracker wins |
|------|-------------|--------------------------|
| Google Sheets / Excel | Flexible, free, familiar | No automation, no email integration, no folder creation. Everything manual. The baseline that Library Tracker replaces. |
| Notion / Airtable | Flexible databases | Not composer-specific. No brief parsing, no inbox integration, no file naming. Requires significant setup to approximate this workflow. |
| Trello / Asana | Task/project management | Too generic. No music workflow concepts at all. |
| Songtradr / Musicbed | Sync licensing marketplaces | Distribution platforms, not project management. Don't help with briefs, status, or invoicing. |
| **Library Tracker** | Composer-specific project management | Reads briefs. Names folders. Watches inbox. Tracks invoices. Built for exactly this job. |

**The moat:** No existing tool combines brief parsing + filesystem integration + email-driven status updates in a composer-specific workflow. This combination is the product. It is difficult to replicate in a generic tool because it requires deep understanding of how library music workflows actually work.

---

## 12. Out of Scope (v1)

- Mobile app (desktop-first; mobile comes later)
- Multi-user collaboration on the same library
- Time tracking / timesheets
- Royalty / split-sheet management
- DAW integration
- Calendar view
- Financial reporting / tax export
- Royalty statement parsing

---

## 13. Open Questions

These need decisions before or during Phase 2:

| Question | Recommendation |
|---------|----------------|
| Desktop distribution: Mac App Store vs. direct download? | Direct download first (Gatekeeper exception handling is simpler than App Store sandboxing for filesystem access). App Store later. |
| AI provider for brief parsing and email inference? | Claude API (vision support, strong instruction-following, prompt caching for cost control). Monitor per-user spend. |
| Pricing validation: is $14/mo right? | Test with 3 variants during beta ($9 / $14 / $19). Let data decide. |
| Legal: privacy policy, terms of service? | Required before public launch and before Gmail OAuth application. Draft these in parallel with Phase 2. |
| App name: "Library Tracker" final? | Consider whether it's searchable and distinct. "LibraryTrack", "Codesheet", or a music-specific name may perform better in SEO. Validate during beta. |

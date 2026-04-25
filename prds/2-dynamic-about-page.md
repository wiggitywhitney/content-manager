# PRD: Dynamic About Page

**Issue**: [#2](https://github.com/wiggitywhitney/content-manager/issues/2)
**Status**: In Progress
**Priority**: Medium
**Created**: 2025-09-26
**Last Updated**: 2026-04-25

## Problem Statement

Whitney's About page on her micro.blog site is static and doesn't reflect where she is currently active. Visitors can't tell which shows are still publishing, which are on hiatus, and where to find her latest work — without visiting each destination separately.

## Solution Overview

The About page shows:
1. A professional bio (static, finalized)
2. A list of links to active content channels, auto-hidden when they go quiet
3. SDI (Software Defined Interviews) always at the bottom, no freshness rule

Activity is determined by reading the live production spreadsheet. A channel disappears from the list when no new content of its type/show has been published within the channel's freshness threshold. No manual flagging needed — the page stays current as Whitney publishes normally.

## User Experience

### New Workflow
1. Whitney publishes content as normal
2. The daily sync checks the live spreadsheet for recent activity by type and show
3. The About page updates automatically — active channels appear, quiet channels drop off
4. SDI always appears regardless of activity

### Bio Text (Decision 3)

> Whitney Lee is a creator and systems thinker who explores how observability, AI, and platform engineering connect across the cloud native ecosystem. She brings humor, depth, and clarity to complex technologies while building original frameworks that help others understand how systems fit together. She runs a vibrant YouTube channel, hosts Datadog Illuminated and Software Defined Interviews, has delivered two KubeCon keynotes and countless breakout talks, and combines storytelling and technical rigor to illuminate the human side of cloud native engineering.

## Channel Configuration (Decision 2)

| Channel | Type (col B) | Show filter (col C) | Freshness threshold | Notes |
|---|---|---|---|---|
| Datadog Illuminated | Video | contains "Datadog" or "Illuminated" | 2 months | |
| 🌩️ Thunder | Video | contains "Thunder" | 2 months | |
| ⚡️ Enlightning | Video | contains "Enlightning" | 2 months | |
| You Choose | Video | contains "YouChoose" or "You Choose" | 2 months | |
| Conference Talks | Presentations | — | 5 months | talks are less frequent |
| GitHub | — | — | always shown | static link, TBD |
| Software Defined Interviews | Podcast | — | always shown | always at bottom |

**Ordering**: active channels sorted by most recent content date (newest first); SDI always last.

## Content Format

*Updated per Decision 4: no headings, no separator, flat list.*

```html
<div style="display: flex; align-items: flex-start; gap: 3rem; margin-bottom: 1rem;">
<img src="https://whitneylee.com/uploads/2025/whitney-square.jpg" alt="Whitney Lee" style="width: 200px; border-radius: 0 !important;">
<div style="text-align: left;">
[Bio text]
</div>
</div>

- [Datadog Illuminated](playlist-url)
- [🌩️ Thunder](playlist-url)
- [Conference Talks](presentations-url)
- [GitHub](github-url)
- [Software Defined Interviews](sdi-url)
```

Only active channels appear in the list. SDI always last by ordering (no visual separator). GitHub always present (alwaysShow). Inactive channels are omitted.

## Technical Requirements

### Activity Detection
- Read live production spreadsheet: group rows by Column B (type) and Column C (show)
- A channel is "active" if at least one matching row has a Column D (date) within the freshness threshold from today
- Threshold is calendar-months based (e.g., 2 months = date is within the last ~60 days)

### About Page Generation
- Build Markdown: bio text, then active channel list, then separator + SDI
- Only call `microblog.editPage` if generated Markdown differs from current page content — read current `description` first, compare, skip if identical
- Use existing `microblog.editPage` XML-RPC pattern from `src/update-page-visibility.js` (MarsEdit token, not Micropub)
- Playlist/page URLs are defined in the channel config — not pulled from the spreadsheet

### No Spreadsheet Schema Changes Needed
- Reads existing columns (B=Type, C=Show, D=Date) only
- Note: `sync-content.js` was extended to read columns J/K earlier; those changes are harmless and remain but are not used by this feature

## Implementation Milestones

### Milestone 1: Channel config and activity detection

**Step 0:** Read related research before starting: [Research: Micro.blog API](../docs/research/microblog-api.md)

*Updated per Decision 1: replaces original "Spreadsheet Schema Extension." No spreadsheet columns to add.*

- [x] Create `src/config/about-page-channels.js` exporting the channel list: each entry has `name`, `type`, `showFilter` (string to match against col C, or null), `thresholdDays`, `url`, `alwaysShow` (bool), `sortLast` (bool). SDI has `alwaysShow: true, sortLast: true`.
- [x] Implement `getActiveChannels(validRows, todayDate)` in `src/update-about-page.js`: filters the already-parsed rows array from the live spreadsheet by each channel's type+showFilter, checks if any matching row has a date within `thresholdDays`, returns ordered array of active channel objects. Always-show channels are included regardless.
- [x] Write unit tests for `getActiveChannels`: all channels active; some channels inactive (no recent content); all video channels inactive (only SDI and always-shown remain); SDI always at bottom; correct ordering by most recent date.

**Success Criteria**: Given a set of spreadsheet rows and a date, `getActiveChannels` returns the correct active channel list with SDI always last.

---

### Milestone 2: About Page content generator

**Step 0:** Read related research before starting: [Research: Micro.blog API](../docs/research/microblog-api.md)

*Updated per Decisions 1–3: generates channel list + bio instead of featured item. Bio text is finalized.*

**Before starting**: All channel URLs in `src/config/about-page-channels.js` are now resolved — Datadog Illuminated (`PLVOmGuoGYFgpj1-kAXLRKmFWqZ99HAHu7`) and You Choose were both confirmed 2026-04-25. No URL gathering needed before starting this milestone.

- [x] Implement `generateAboutPageMarkdown(activeChannels)` in `src/update-about-page.js`: produces the About page Markdown — bio text (hardcoded from Decision 3), `## Where to Find My Work` section with active channel links, separator, SDI at bottom
- [x] Implement content injection: call `microblog.getPages` to find the About page ID (`is_template: true`, title "About"), read current `description`, compare with generated Markdown, and call `microblog.editPage` only if different
- [x] Test on a **non-critical template page first** before touching the About page — the About page is `is_template: true` and rendering depends on Hugo theme; verify `editPage` produces expected output
- [x] Test with sample active/inactive channel lists; verify rendered output on Micro.blog

**Codebase context**: `src/update-page-visibility.js` has the working `xmlrpcRequest` and `setPageNavigationVisibility` patterns. `getPages` and `editPage` both use `MICROBLOG_XMLRPC_TOKEN` (HTTP Basic auth). See `~/.claude/rules/microblog-api-gotchas.md` for parameter order.

**Success Criteria**: Can generate and push About page Markdown with correct bio text and active channel list.

---

### Milestone 3: Integration with existing sync

**Step 0:** Read related research before starting: [Research: Micro.blog API](../docs/research/microblog-api.md) and `~/.claude/rules/microblog-api-gotchas.md` (updated with Micro.blog-specific quirks discovered during M2 live testing).

**Codebase context for wiring:**
- `updateAboutPage(validRows, todayDate)` is already implemented in `src/update-about-page.js` — call it with the `validRows` array from `sync-content.js`'s existing Sheets read and `new Date()`
- `src/run-update-about-page.js` shows the standalone runner pattern (reads spreadsheet + calls updateAboutPage) — useful as a reference but the goal is to integrate into sync-content.js, not keep using the standalone script
- About page confirmed live at `https://whitneylee.com/about/` (page ID 849042, discovered dynamically via getPages)
- `sync-content.js` `validRows` rows have `{ name, type, show, date, ... }` — `getActiveChannels` only needs `type`, `show`, and `date`, all present

- [ ] Add an about-page update step to `daily-sync.yml` (after content sync step, before page visibility update)
- [ ] Wire `src/update-about-page.js`: pass it the parsed `validRows` array that `sync-content.js` already builds, plus today's date, so it doesn't need its own Sheets API call
- [ ] Add error handling consistent with `update-page-visibility.js` (same retry/backoff pattern, non-fatal on failure)
- [ ] Test end-to-end: content item in spreadsheet → GitHub Actions run → About page reflects updated channel list

**Success Criteria**: About page updates automatically as part of the daily sync cycle without an additional Sheets API call.

---

### Milestone 4: Testing and cleanup

- [ ] Test all activity scenarios: all channels active; some inactive; all video channels inactive (SDI + static links only)
- [ ] Test change detection: no `editPage` call when Markdown hasn't changed
- [ ] Update PROGRESS.md with feature-level entry

**Success Criteria**: All edge cases handled. No spurious XML-RPC calls.

## Decision Log

| # | Date | Decision | Rationale |
|---|------|----------|-----------|
| 1 | 2026-04-25 | Replace Highlight column approach with channel list | Lower maintenance (no manual flagging needed), self-maintaining as Whitney publishes, better visitor experience for discovery over curation |
| 2 | 2026-04-25 | Channel list and freshness thresholds | Videos/Podcasts: 2 months; Talks: 5 months (less frequent); SDI: always shown (most stable content), always at bottom |
| 3 | 2026-04-25 | Bio text finalized | Whitney provided final text — hardcode in the generator, no spreadsheet column needed |
| 4 | 2026-04-25 | About page format: no section headings, no separator, flat link list with photo | Live test revealed the PRD's draft format (# heading, ## heading, --- separator) was redundant and cluttered. "About Whitney" redundant (page title already says "About"); "Where to Find My Work" heading unnecessary; `---` separator before SDI unwanted. Final format: HTML flex block with photo left + bio right, then a flat Markdown link list (no headings, no separator, SDI last by ordering only). |

## Success Criteria

### Functional Requirements
- [ ] About page shows bio text matching Decision 3 verbatim
- [ ] Active channels appear as links; inactive channels are hidden
- [ ] SDI always appears at the bottom regardless of activity
- [ ] Page updates automatically each day without any manual action from Whitney

### Non-Functional Requirements
- [ ] About page updates maintain same reliability as existing sync
- [ ] No unnecessary API calls when page content hasn't changed
- [ ] System handles missing or malformed spreadsheet data gracefully (fails explicitly, doesn't corrupt the page)

## Dependencies & Risks

### External Dependencies
- **Google Sheets API**: Already used by sync-content.js — no new API changes needed
- **Micro.blog XML-RPC API**: `microblog.editPage` confirmed working for page content updates (uses MarsEdit token, not Micropub token)

### Technical Risks
- **Template Page Rendering**: About page is a Hugo template page (`is_template: true`). Editing `description` updates raw content, but final rendering depends on the Hugo theme template. Must test on a non-critical page first.
- **Change detection reliability**: `microblog.getPages` must return the current `description` field for diffing to work. Verify this before relying on it; fall back to always pushing if `description` is not returned.

### Notes
- `sync-content.js` reads columns J/K (highlight/priority) — those changes from 2026-04-24 remain in code and are harmless. They are not used by this feature.
- All channel URLs in `src/config/about-page-channels.js` are resolved. `You Choose` confirmed 2026-04-25 (`PLyicRj904Z9-FzCPvGpVHgRQVYJpVmx3Z`). `Datadog Illuminated` confirmed 2026-04-25 (`PLVOmGuoGYFgpj1-kAXLRKmFWqZ99HAHu7`). No blockers for Milestone 2.
- **Deferred: per-channel descriptions** — During Milestone 1 implementation, the question of whether each channel link should have a one-line description (e.g., `- [🌩️ Thunder](url) — Short-form edited videos`) was raised and explicitly deferred. The current content format (bare links, no descriptions) is intentional for now. If descriptions are added later, the `about-page-channels.js` config structure supports adding a `description` field, and `generateAboutPageMarkdown` would need updating.
- **Implementation detail: threshold boundary** — `getActiveChannels` uses `daysDiff > thresholdDays` (strict greater-than), so content published exactly `thresholdDays` days ago is still considered active. Content `thresholdDays + 1` days old is stale.
- **Implementation detail: showFilter matching** — Case-insensitive substring match. A row with `show = "🌩️ Thunder Shorts"` matches the Thunder channel's `showFilter: ['Thunder']`.
- **Implementation detail: description-absent fallback** — `parseGetPagesResponse` returns `description: ''` when the field is missing from the API response. An empty string never equals the generated Markdown, so `editPage` is always called in that case — this is the "fall back to always pushing if description not returned" behavior from the Technical Risks section, implemented naturally.
- **Implementation detail: DI pattern for testability** — `updateAboutPage(validRows, todayDate, { xmlrpcFn })` accepts an optional `xmlrpcFn` parameter (defaults to the real `xmlrpcRequest`). Tests pass a Jest mock. Milestone 3 integration code should call `updateAboutPage(validRows, todayDate)` with no third argument — the default is the live implementation.
- **Prerequisite for Milestone 3** — Do not start Milestone 3 until M2 items 3–4 (manual Micro.blog tests) are complete and checked off. The wiring in `daily-sync.yml` is only safe to ship after `updateAboutPage` has been verified against a live Micro.blog page.

## Definition of Done

1. About page bio text matches Decision 3 exactly
2. Active content channels appear as clickable links
3. Channels auto-hide when they go quiet (per Decision 2 thresholds)
4. SDI always appears at the bottom
5. Page updates automatically via the daily sync cycle — no manual action needed

## Progress Log

### 2026-04-25
- **Design Pivot (Decision 1)**: Replaced Highlight column approach with channel list. Original Milestones 1, 3, 5 redesigned; Milestone 6 folded into new Milestone 4.
- **Bio Text Finalized (Decision 3)**: Whitney provided final bio text; hardcoded in generator.
- **Channel Config Defined (Decision 2)**: Freshness thresholds set: 2 months for video/podcast, 5 months for talks. SDI always shown.

### 2026-04-24
- **Partial Milestone 1 work**: `sync-content.js` extended to read columns J/K (highlight/priority) with 13 unit tests. These code changes remain but the Highlight column approach was superseded by Decision 1 above.

### 2026-04-08 (Freshness Check)
- **API Blocker Resolved**: `microblog.editPage` XML-RPC method confirmed capable of updating About page content. Already battle-tested in `src/update-page-visibility.js` for category navigation pages.
- **Technology Updated**: Python references removed. Stack is 100% Node.js/JavaScript (CommonJS).
- **Risk Identified**: About page is a Hugo template page (`is_template: true`). Rendering of edited content depends on theme template — must test on a non-critical page first.
- **Research Documented**: See [Research: Micro.blog API](../docs/research/microblog-api.md)

### 2025-09-26
- **PRD Created**: Initial requirements gathering and documentation
- **GitHub Issue**: [#2](https://github.com/wiggitywhitney/content-manager/issues/2) created

---

*This PRD will be updated as implementation progresses and requirements are refined.*

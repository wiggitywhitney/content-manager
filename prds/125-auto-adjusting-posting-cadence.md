# PRD: Auto-Adjusting Posting Cadence

**GitHub Issue**: [#125](https://github.com/wiggitywhitney/content-manager/issues/125)

**Status**: Not Started

**Priority**: High

---

## Problem Statement

Posting cadence is controlled by two static settings: the `TWO_POSTS_PER_DAY` env var in `.github/workflows/daily-sync.yml` (currently hardcoded `'false'`) and the cron schedule, which fires on all seven days of the week regardless of how much content is in the queue.

The queue depth fluctuates significantly as content is added in batches — a single new episode can add anywhere from 1 to several dispatch units (multi-platform social posts for one piece of content, plus a career row) at once. Nobody is watching queue depth day to day to decide when cadence should change, so the schedule is either too slow (content piles up, engagement opportunities go stale) or, if manually bumped to two-a-day and then forgotten, risks running the queue dry.

## Solution Overview

Calculate a real "queue depth" number on every daily-sync run, and drive posting cadence off it automatically via a hysteresis state machine — no manual workflow edits required.

**Queue depth** = pending career rows (staged spreadsheet, no Micro.blog URL yet) + social dispatch units, where a dispatch unit is one Group-ID batch (multiple rows sharing a Group ID — e.g., the same episode posted to LinkedIn, Mastodon, and Bluesky — count as **one** unit, matching how the dispatcher actually consumes them) or one ungrouped row. This is computed across **both** the non-micro.blog-only tier and the micro.blog-only tier and summed.

**Cadence states**, moved between via depth thresholds with separate enter/exit points (hysteresis) so a single batch addition/removal near a boundary doesn't flip the mode day to day:

| State | Enter | Exit | Behavior |
|---|---|---|---|
| Two-posts/day | depth ≥ 60 | depth ≤ 40 → drop to one/day | Morning + evening slots both post (existing two-post-per-day logic) |
| One-post/day, all days | 15 ≤ depth < 60 | — | Default/normal band — one post daily, every day of the week |
| One-post/day, weekdays only | depth < 15 | depth ≥ 25 → return to all days | One post daily, Saturday and Sunday runs skip entirely |

State (current mode, the depth that produced it, and when it last changed) persists in a new "Cadence State" tab in the staged spreadsheet, so each run can evaluate hysteresis against the *previous* mode, not just the current depth in isolation.

On every mode transition, a Datadog event fires (via the Events API, using the DD_API_KEY secret already read in the workflow for the LinkedIn-token-expiry metric) so a Datadog monitor can alert on cadence changes.

## User Experience

### Before
- Whitney manually edits `TWO_POSTS_PER_DAY` in the workflow YAML and commits/pushes to change cadence.
- No visibility into queue depth without running an ad hoc script or asking Claude.
- Weekend posting is always on; there's no way to throttle it without also throttling weekdays.

### After
- Cadence adjusts itself as the queue grows or shrinks — no code change, no PR, no manual edit.
- Whitney can see current mode and depth history by opening the "Cadence State" tab in the staged spreadsheet.
- A Datadog monitor notifies her whenever cadence changes, so she's aware without having to check.
- A manual override remains available (see Decision Log #4) for cases where she wants to force a cadence regardless of computed depth (e.g., ahead of a known content drought or a planned burst).

## Technical Architecture

### Current Implementation
- `src/social-posts-queue.js` — reads/parses the Social Posts Queue tab; `fetchAllSocialPosts`, `isMicroblogOnly`, `isDispatchable` already exist and are reused for the depth calculation.
- `src/sync-content.js` — reads the live production spreadsheet's `Sheet1`; `rowsToPost = validRows.filter(row => !row.microblogUrl)` is the existing pending-career-rows filter, reused for the career-row count.
- `.github/workflows/daily-sync.yml` — `Determine post priority` step computes `career_first`, `is_morning_slot`, `social_has_pending` and sets `skip_run` for single-post-mode evening runs. `TWO_POSTS_PER_DAY` is a hardcoded env var on the `daily-sync` job.
- `scripts/determine-slot.sh` — classifies which cron fired (morning/evening) off `github.event.schedule`.

### Proposed Changes

1. **New module**: a queue-depth calculator (e.g. `src/cadence/queue-depth.js`) exporting a function that returns the combined depth number described above, built on top of the existing `fetchAllSocialPosts`/`isDispatchable`/`isMicroblogOnly` exports and the existing career-row pending filter logic from `sync-content.js`.
2. **New module**: a pure hysteresis state-machine function (e.g. `src/cadence/state-machine.js`) taking `(previousMode, currentDepth)` and returning `{ mode, changed }` per the threshold table above. Pure and side-effect-free so it's fully unit-testable without any network/sheet mocking.
3. **New spreadsheet tab**: "Cadence State" in the staged spreadsheet (`1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts`), provisioned similarly to `src/create-social-posts-sheet.js`. Columns: `Date`, `QueueDepth`, `Mode`, `ChangedAt` (only populated on transition rows, or every row — implementer's call, documented in the milestone). Read/write helpers live alongside the state-machine module.
4. **Workflow integration**: the `Determine post priority` step reads the previous state, computes today's depth and next mode, writes a new state row, and:
   - Sets the *effective* two-posts-per-day behavior from computed mode, respecting the `TWO_POSTS_PER_DAY` override described in Decision Log #4.
   - Adds a weekend-skip gate: when effective mode is weekday-only and today is Saturday or Sunday, both cron slots exit early via the existing `skip_run` mechanism.
5. **Datadog event**: on `changed: true` from the state machine, POST a Datadog event tagged with `previous_mode`, `new_mode`, `queue_depth` using the DD_API_KEY already fetched in the `Read credentials from GSM` step. A metric for current queue depth is also emitted every run (changed or not) so the monitor has a continuous series to threshold against, not just discrete events.

### Design Notes

- The feature PR created by `/prd-done` needs the `run-acceptance` label to trigger acceptance gate CI. This is handled automatically by `/prd-done` when acceptance gate tests are detected.

## Success Criteria

- Queue depth calculation matches manual verification (career pending rows + grouped social dispatch units across both tiers) against known spreadsheet state.
- State machine produces correct transitions for the full threshold table, including boundary values (depth exactly 60, 40, 15, 25) and both directions of each transition, with no flapping when depth oscillates within a few units of a boundary.
- Cadence State tab accurately reflects current mode and updates only on real transitions (or every run, per implementer's documented choice).
- Weekday-only mode correctly skips both cron slots on Saturday and Sunday; two-posts/day and one-post/day-all-days modes leave existing day-parity and slot-detection logic untouched.
- A Datadog event fires on every mode transition and is visible in Datadog; a monitor built on it fires correctly (validated with at least one forced test transition).
- Manual override (`TWO_POSTS_PER_DAY=true`/`false`) still works and takes precedence over computed mode; `auto` is the default.

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hysteresis thresholds turn out miscalibrated for real content patterns (batch sizes larger/smaller than assumed) | Medium | Thresholds are being introduced as configurable values, not hardcoded magic numbers, and the Cadence State tab's history makes miscalibration visible and easy to diagnose. Revisit after a few weeks of production data. |
| New spreadsheet tab desyncs from workflow's assumptions (e.g., manually edited by mistake) | Low | Read defensively (e.g., missing/malformed state row falls back to `one_per_day_all_days`, the safe default), same pattern as existing `checkSocialPostedToday`'s error handling. |
| Datadog event/metric emission fails silently and nobody notices cadence stopped adjusting | Medium | Emission failures should log a warning but never block the rest of the run (same `continue-on-error` pattern used elsewhere in the workflow), and the Cadence State tab remains the source of truth even if the Datadog leg fails. |

## Dependencies

**None** — self-contained addition to the existing daily-sync workflow and staged spreadsheet.

## Decision Log

### 1. Queue depth formula
**Decision**: Queue depth = pending career rows + social dispatch units (deduplicated by Group ID) summed across both the non-micro.blog-only tier and the micro.blog-only tier.
**Rationale**: A dispatch unit is what actually gets consumed in one posting day — counting rows instead of units would badly overstate depth for any multi-platform post sharing a Group ID (verified against live data: 29 non-micro.blog rows currently collapse to 20 real dispatch units).

### 2. Hysteresis thresholds
**Decision**: Two-posts/day enters at depth ≥ 60, exits at ≤ 40. Weekday-only enters at depth < 15, exits at ≥ 25. Everything else is the default one-post/day-all-days band.
**Rationale**: Thresholds are framed as "days of runway at current cadence," since depth ≈ days of runway at one post/day. The gap sizes (20 at the high end, 10 at the low end) are chosen to exceed the size of a typical content batch addition seen in the current queue (e.g., a 4-unit episode series), so a single new episode landing in the queue doesn't immediately flip the mode back.

### 3. State persistence
**Decision**: Persist current mode in a new "Cadence State" tab in the staged spreadsheet, not a committed repo file or GitHub Actions cache.
**Rationale**: Consistent with this repo's existing pattern of treating spreadsheets as the source of truth for operational state; human-readable and manually correctable without a git commit; avoids adding bot-authored daily commits to the repo.

### 4. Manual override behavior
**Decision**: `TWO_POSTS_PER_DAY` becomes a three-valued setting: `'auto'` (default — cadence computed by the state machine), `'true'` (force two-posts/day), `'false'` (force one-post/day). The state machine still computes and records what it *would* do even while an override is active, so no history is lost and returning to `'auto'` picks up cleanly. **The override only pins the posts-per-day dimension — it does NOT affect weekend gating.** Weekday-only mode is driven purely by computed depth regardless of override value. So `TWO_POSTS_PER_DAY=false` at depth 8 still skips weekends; `TWO_POSTS_PER_DAY=true` at depth 8 posts twice a day, every day including weekends.
**Rationale**: Preserves the existing manual escape hatch for cases like a known upcoming content drought, while making the computed cadence the default behavior this PRD exists to deliver. Keeping weekend gating independent of the override avoids collapsing two orthogonal concerns (post count vs. which days to post) into one variable. This is an assumption made without a real-time round-trip with Whitney — flagged here for her to confirm or override.

### 5. Weekend enforcement mechanism
**Decision**: Weekday-only mode is enforced with a runtime skip gate (both cron slots exit early on Saturday/Sunday), not by changing the cron schedule itself.
**Rationale**: The cron schedule in the workflow YAML is static; a runtime gate is reversible instantly (as soon as depth recovers) without needing a workflow-file edit, matching the existing `skip_run` pattern already used for single-post-mode evening runs.

## Milestones

- [ ] **Queue depth calculation implemented and tested**: New module computing combined depth (career pending rows + grouped social dispatch units across both tiers) per Decision #1. Unit tests cover: rows with shared Group IDs collapsing to one unit, ungrouped rows counting individually, failed-but-retryable rows counting as dispatchable, posted rows excluded, and the micro.blog-only vs. non-micro.blog-only tiers both being included in the total. Reuses `fetchAllSocialPosts`, `isDispatchable`, `isMicroblogOnly` from `src/social-posts-queue.js` and the existing `!row.microblogUrl` pending filter from `src/sync-content.js` — do not reimplement this logic.
- [ ] **Hysteresis state machine implemented and tested**: Pure function taking `(previousMode, currentDepth)` and returning the next mode per the threshold table in Decision #2. The function only ever receives one of the three real mode strings as `previousMode` — cold-start defaulting to `one_per_day_all_days` when no prior state exists is the caller's (Cadence State milestone's) responsibility, not this function's; do not add a fourth pseudo-state or null-handling branch inside this module. Unit tests cover every transition path (including staying in the same mode) and exact boundary values (59/60/61, 39/40/41, 14/15/16, 24/25/26). No network or spreadsheet calls in this module — it must be testable in isolation.
- [ ] **Cadence State tab provisioned with read/write helpers**: New "Cadence State" tab created in the staged spreadsheet (script modeled on `src/create-social-posts-sheet.js`), plus functions to read the most recent state row and append a new one. A new state row is appended **on every run, not only on transitions** — required so the tab's history can be used to evaluate whether the thresholds are miscalibrated, per the Risks table. Defensive read: a missing or malformed state row must fall back to `one_per_day_all_days` (the safe default) rather than throwing, per the Risks table.
- [ ] **Workflow integration**: Step 0: Read the queue-depth, state-machine, and Cadence State milestones above — this milestone wires their outputs together and must not duplicate their logic. Update the `Determine post priority` step in `.github/workflows/daily-sync.yml` to: read previous state, compute today's depth and next mode, write the new state row, resolve the three-valued `TWO_POSTS_PER_DAY` override per Decision #4 (override affects only posts-per-day; weekend gating always follows computed depth regardless of override), and add the Saturday/Sunday skip gate for weekday-only mode. Confirm via `npm run test:integration` and `npm run test:e2e` plus a manual `DRY_RUN=true` run that existing day-parity fallback and slot-detection logic (`scripts/determine-slot.sh`) are unaffected when the resolved mode is `one_per_day_all_days` (today's default behavior).
- [ ] **Datadog transition event and depth metric emitted**: On every run, emit a queue-depth metric following the exact pattern in `submitTokenExpiryMetric` (`src/post-linkedin.js:32-77`) — same `https://api.datadoghq.com/api/v2/series` endpoint, same no-op-when-`DD_API_KEY`-unset behavior, same log-not-throw error handling. On `changed: true` from the state machine, additionally emit a Datadog event tagged with previous mode, new mode, and depth via the separate Events API endpoint (`https://api.datadoghq.com/api/v1/events`), using the same auth header and error-handling shape. Emission failures log a warning and never fail the run (`continue-on-error`, matching the existing token-expiry metric step).
- [ ] **Datadog monitor created and validated**: A Datadog monitor is created against the emitted event/metric so cadence changes generate an actual alert. Validate end-to-end with at least one forced test transition (e.g., temporarily lowering a threshold in a test run) confirming the monitor fires.
- [ ] **Documentation updated**: `CLAUDE.md`'s "Daily limit"/"Priority" section in this repo's project instructions updated to describe the new auto-adjusting cadence model, the three states and their thresholds, the Cadence State tab, and the `TWO_POSTS_PER_DAY=auto|true|false` override.

## Implementation Plan

### Phase 1: Core Logic (no workflow changes yet)
- Queue depth calculation module + tests
- Hysteresis state machine module + tests
- Cadence State tab provisioning + read/write helpers + tests

### Phase 2: Integration
- Wire depth calculation + state machine + state persistence into `Determine post priority`
- Add weekday-only weekend-skip gate
- Resolve three-valued `TWO_POSTS_PER_DAY` override

### Phase 3: Observability & Documentation
- Datadog event/metric emission
- Datadog monitor creation and validation
- Documentation updates

## Open Questions

- Should there be a distinct, more urgent alert path for depth approaching zero (queue about to run dry), separate from the weekday-only cadence transition? Not required for this PRD's scope, but worth considering once the Cadence State history has accumulated real data.

## Progress Log

### 2026-09-10
- PRD created following a spitball discussion on queue-depth calculation and hysteresis thresholds.
- Thresholds and state-persistence approach confirmed with Whitney; manual-override three-valued design flagged as an assumption pending her confirmation.

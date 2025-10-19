# PRD: Rate-Limited Content Publishing

**Issue**: [#8](https://github.com/wiggitywhitney/content-manager/issues/8)
**Status**: Planning
**Priority**: Medium
**Created**: 2025-10-19
**Last Updated**: 2025-10-19

## Problem Statement

When bulk adding recent content to the spreadsheet (2025_Content_Created), the automated sync system (PRD-1) will immediately post all new content to Micro.blog and syndicate to all POSSE-connected platforms (PRD-7). This creates:

- **Timeline spam**: Followers see a flood of posts all at once, overwhelming their feeds
- **Reduced engagement**: Multiple posts competing for attention simultaneously reduces individual post visibility
- **Poor user experience**: Appears unprofessional or automated (which it is, but shouldn't feel that way)
- **Social media fatigue**: Followers may unfollow or mute due to excessive posting frequency
- **Lost opportunity**: Spreading posts over time maintains consistent presence vs sporadic bursts

## Solution Overview

Implement rate limiting that publishes only one new piece of content per day when multiple new rows are detected in the spreadsheet:

1. **New Row Queue**: Detect multiple new rows (empty Column H) and queue them
2. **Daily Publishing Limit**: Publish maximum of 1 post per day from the queue
3. **Chronological Order**: Publish in chronological order by Date column (oldest first)
4. **Transparent Status**: Track queue status in spreadsheet or state file
5. **Override Capability**: Allow manual override for time-sensitive content

**Important**: Rate limiting applies ONLY to new/recent content added to spreadsheet after POSSE setup. Historical content (PRD-6) imported with cross-posting disabled, so no rate limiting needed.

## User Experience

### Current Workflow (After PRD-1, Before Rate Limiting)
1. Whitney adds 10 new rows to spreadsheet (recent content from past month)
2. Next hourly sync detects all 10 rows have empty Column H
3. System immediately creates 10 Micro.blog posts
4. All 10 posts syndicate to fediverse, Bluesky, Flickr, LinkedIn simultaneously
5. Followers see flood of 10 posts at once

### New Workflow (With Rate Limiting)
1. Whitney adds 10 new rows to spreadsheet
2. Next hourly sync detects all 10 rows have empty Column H
3. System queues all 10 rows for rate-limited publishing
4. System publishes 1 post immediately (or on first day)
5. Remaining 9 posts publish at rate of 1 per day over next 9 days
6. Each post syndicates normally to all POSSE platforms
7. Whitney can check queue status to see publishing schedule
8. Whitney can override rate limiting if needed (manual "publish now" flag)

## Technical Requirements

### Queue Detection & Management

**Queue Identification**:
- Multiple new rows detected (Column H empty) in single sync run
- Define "multiple": More than X rows (configurable, default: 3+ rows)
- Rows with empty Column H = unpublished content = potential queue candidates

**Queue Storage Options**:
- **Option A**: New Column I ("Queue Position") in spreadsheet
  - Values: Empty (publish immediately), "1", "2", "3"... (queue position)
  - Visible to user, easy to manually adjust
  - Requires spreadsheet writes (already have Editor permission from PRD-1)
- **Option B**: Separate state file in repository
  - JSON file tracking queued row indices and publish dates
  - Hidden from user, purely system state
  - Requires git commits on each queue update
- **Option C**: Hybrid approach
  - State file tracks queue, Column I shows "Queued" status for visibility
  - Best of both: system state + user visibility

**Recommendation**: Option C (state file for logic, Column I for user visibility)

### Rate Limiting Logic

**Triggering Rate Limiting**:
```
IF new_rows.count >= RATE_LIMIT_THRESHOLD (default: 3)
  THEN queue all new rows except first (or publish first immediately)
ELSE
  publish all new rows immediately (no rate limiting)
```

**Publishing Schedule**:
- **Strategy 1**: Publish 1 post per day at sync time
  - Next sync after 24+ hours publishes next queued item
  - Simple logic: check last publish timestamp, only publish if 24+ hours elapsed
- **Strategy 2**: Publish 1 post per calendar day
  - One post per day based on calendar date (midnight boundary)
  - More predictable schedule for user
- **Strategy 3**: Spread evenly over time window
  - User specifies: "Publish these 10 posts over 2 weeks"
  - System calculates spacing: 10 posts / 14 days = ~1 every 1.4 days

**Recommendation**: Strategy 1 (simplest) with configuration for threshold and interval

**Configuration Parameters**:
- `RATE_LIMIT_ENABLED`: true/false (default: true)
- `RATE_LIMIT_THRESHOLD`: Number of new rows to trigger rate limiting (default: 3)
- `RATE_LIMIT_INTERVAL`: Hours between queue publishes (default: 24)
- `RATE_LIMIT_MAX_PER_RUN`: Maximum posts from queue per sync run (default: 1)

### Chronological Ordering

**Publishing Order**:
- Queue should publish in chronological order by Date column (oldest first)
- Maintains natural timeline progression
- Avoids out-of-order posts confusing followers

**Implementation**:
1. Detect new rows (Column H empty)
2. Sort new rows by Date column (ascending - oldest first)
3. If count >= threshold, queue all except first (or all if strict rate limiting)
4. Publish from queue in order, respecting rate limit

### Override Capability

**Manual Override Options**:
- **Option A**: Column J ("Publish Priority")
  - Values: Empty (normal), "immediate" (bypass queue), "hold" (skip indefinitely)
  - User sets "immediate" to force publish on next sync
- **Option B**: CLI command
  - `npm run sync -- --force-queue` publishes all queued items immediately
  - Requires manual intervention, not spreadsheet-based
- **Option C**: Both A and B

**Recommendation**: Option C (spreadsheet control for flexibility, CLI for emergencies)

### State Tracking

**Queue State File** (`state/publish-queue.json`):
```json
{
  "lastPublishDate": "2025-10-19T14:30:00Z",
  "queue": [
    {
      "rowIndex": 15,
      "title": "Video Title 1",
      "date": "October 10, 2025",
      "queuedAt": "2025-10-19T14:30:00Z",
      "publishAfter": "2025-10-20T14:30:00Z"
    },
    {
      "rowIndex": 16,
      "title": "Video Title 2",
      "date": "October 11, 2025",
      "queuedAt": "2025-10-19T14:30:00Z",
      "publishAfter": "2025-10-21T14:30:00Z"
    }
  ]
}
```

**Spreadsheet Column I** ("Queue Status"):
- Values: Empty (published or immediate), "Queued - Oct 20", "Queued - Oct 21"
- Human-readable publish schedule
- Updated by sync script after queue changes

## Success Criteria

### Functional Requirements
- [ ] System detects multiple new rows (3+) and queues them
- [ ] System publishes maximum 1 post per day from queue
- [ ] Queue respects chronological order (oldest first by Date column)
- [ ] Column I shows queue status for user visibility
- [ ] Manual override (Column J "immediate") bypasses queue
- [ ] CLI force command publishes all queued items immediately
- [ ] State file tracks queue and last publish date
- [ ] Configuration parameters work correctly (threshold, interval, max per run)

### Non-Functional Requirements
- [ ] Rate limiting transparent to followers (posts appear consistently over time)
- [ ] No posts lost or skipped due to queue management
- [ ] Queue survives sync errors (persisted in state file)
- [ ] User can understand queue status at a glance (Column I visibility)
- [ ] System logs queue operations clearly (added to queue, published from queue)

## Implementation Milestones

### Milestone 1: Queue Detection & State Management
**Estimated Time**: ~2-3 hours

- [ ] Add configuration parameters to script
  - `RATE_LIMIT_ENABLED`, `RATE_LIMIT_THRESHOLD`, `RATE_LIMIT_INTERVAL`, `RATE_LIMIT_MAX_PER_RUN`
  - Load from environment variables or config file
- [ ] Implement new row detection logic
  - Count rows with empty Column H
  - Check if count >= threshold
- [ ] Create queue state file structure
  - Define JSON schema for `state/publish-queue.json`
  - Implement read/write functions
- [ ] Implement queue sorting by Date column
  - Parse dates from spreadsheet Date column
  - Sort in ascending order (oldest first)
- [ ] Add queue state to sync script
  - Load queue at script start
  - Save queue at script end (or after changes)

**Success Criteria**: Script can detect new rows, create queue structure, and persist state

### Milestone 2: Rate-Limited Publishing Logic
**Estimated Time**: ~2-3 hours

- [ ] Implement rate limiting decision logic
  - Check last publish timestamp
  - Calculate time since last publish
  - Determine if eligible to publish from queue (24+ hours elapsed)
- [ ] Implement queue publishing
  - Select next item from queue (FIFO, chronologically sorted)
  - Publish via existing Micropub logic (reuse PRD-1 code)
  - Remove published item from queue
  - Update last publish timestamp
- [ ] Handle immediate publish (non-queued items)
  - If new_rows < threshold, publish all immediately
  - First item might publish immediately even if others queued
- [ ] Implement queue management operations
  - Add to queue
  - Remove from queue (after publish)
  - Skip items (if priority=hold)
  - Clear queue (for force publish)

**Success Criteria**: Script publishes 1 post per day from queue, respecting rate limit

### Milestone 3: Spreadsheet Visibility (Column I & J)
**Estimated Time**: ~1-2 hours

- [ ] Add Column I: "Queue Status" to spreadsheet header
- [ ] Implement Column I write logic
  - Empty (published/immediate)
  - "Queued - [Date]" (human-readable publish date)
  - Update after queue changes
- [ ] Add Column J: "Publish Priority" to spreadsheet header
- [ ] Implement Column J read logic
  - Read priority value: empty, "immediate", "hold"
  - Apply priority during queue management
  - "immediate" bypasses queue, publishes on next sync
  - "hold" skips publishing indefinitely
- [ ] Update sync script to read Column I & J
  - Extend `parseRow()` to include queueStatus and publishPriority
  - Handle priority logic in publishing decisions

**Success Criteria**: User can see queue status in Column I and control priorities via Column J

### Milestone 4: Override & Force Publishing
**Estimated Time**: ~1-2 hours

- [ ] Implement Column J "immediate" priority logic
  - Detect priority="immediate" in spreadsheet
  - Bypass queue, publish immediately on next sync
  - Clear "immediate" flag after publish (or leave for user to clear)
- [ ] Implement CLI force command
  - Add `--force-queue` flag to npm run sync
  - Publish all queued items in single run (ignore rate limit)
  - Clear queue after force publish
- [ ] Add safety checks
  - Confirm force publish won't create timeline spam (or warn user)
  - Log force publish actions prominently
- [ ] Document override procedures
  - How to use Column J "immediate"
  - When to use `--force-queue` CLI flag
  - Risks and considerations

**Success Criteria**: User can override rate limiting via spreadsheet or CLI

### Milestone 5: Testing & Validation
**Estimated Time**: ~2-3 hours

- [ ] Test queue creation
  - Add 5 new rows to spreadsheet (empty Column H)
  - Verify 4-5 queued, 0-1 published immediately
  - Check Column I shows queue status
  - Verify state file populated correctly
- [ ] Test rate-limited publishing
  - Run sync multiple times over 3-5 days
  - Verify 1 post per day published from queue
  - Verify queue shrinks correctly
  - Verify Column I updates after each publish
- [ ] Test chronological ordering
  - Add rows with out-of-order dates
  - Verify queue publishes in chronological order (by Date column)
- [ ] Test priority overrides
  - Set Column J="immediate" on queued row
  - Verify publishes on next sync (bypasses queue)
  - Set Column J="hold"
  - Verify row skipped indefinitely
- [ ] Test force publish
  - Queue several items
  - Run `npm run sync -- --force-queue`
  - Verify all queued items publish immediately
  - Verify queue cleared
- [ ] Test edge cases
  - Empty queue (no new rows)
  - Single new row (below threshold - no queue)
  - Exact threshold (e.g., 3 rows - edge of triggering)
  - Queue with sync errors (verify queue survives)

**Success Criteria**: All test scenarios pass, rate limiting works reliably

### Milestone 6: Documentation & Monitoring
**Estimated Time**: ~1 hour

- [ ] Document configuration parameters
  - Where to set values (environment variables, config file)
  - Default values and recommendations
  - How to disable rate limiting if needed
- [ ] Document queue management
  - How queue works (detection, sorting, publishing)
  - Column I and J usage for user control
  - State file structure and location
- [ ] Document override procedures
  - When and how to use "immediate" priority
  - When and how to use force publish CLI flag
  - Risks and best practices
- [ ] Add logging for queue operations
  - Log when items added to queue
  - Log when items published from queue
  - Log queue size and next publish date
  - Log override actions (immediate, force)
- [ ] Update PRD-1 documentation
  - Reference rate limiting feature
  - Link to PRD-8 for details

**Success Criteria**: Feature fully documented, easy for user to understand and control

## Dependencies & Risks

### External Dependencies
- **PRD-1**: Sync script and Micropub posting logic (reuse existing code)
- **PRD-7**: POSSE configuration (rate limiting applies after POSSE enabled)
- **Google Sheets API**: Column I & J read/write capabilities
- **GitHub Actions**: Scheduled runs for queue processing

### Technical Risks
- **Queue Drift**: State file and spreadsheet Column I get out of sync
- **Publishing Gaps**: Sync failures cause missed publishing windows (next item not published on time)
- **Chronological Confusion**: Users add content with dates far in past/future, queue ordering unclear
- **Override Abuse**: User sets everything to "immediate", defeats rate limiting purpose
- **Force Publish Spam**: Force command publishes too many items at once, recreates timeline spam problem

### Mitigation Strategies
- **Queue Drift**: Spreadsheet Column I is display-only, state file is source of truth; reconcile on each sync
- **Publishing Gaps**: Missed window publishes next eligible item on next sync (catch-up logic)
- **Chronological Confusion**: Document expected date range, log warnings for unusual dates
- **Override Abuse**: Document best practices, trust user judgment (they control their content)
- **Force Publish Spam**: Log warning when force publishing, recommend using sparingly

## Definition of Done

The feature is complete when:
1. Whitney can add 10 new rows to spreadsheet and see them queue automatically
2. System publishes 1 post per day from the queue over 10 days
3. Column I shows clear queue status ("Queued - Oct 20", "Queued - Oct 21", etc.)
4. Whitney can set Column J="immediate" to bypass queue for urgent content
5. Whitney can run `npm run sync -- --force-queue` to publish all queued items immediately
6. Queue survives sync errors and restarts (persisted in state file)
7. All queue operations logged clearly
8. Feature documented with configuration options and override procedures

## Dependency Chain

```
PRD-1 (Automated Content Publishing) - In Progress, Milestone 5
  ↓
PRD-6 (Historical Content Integration) - Ready to start (cross-posting disabled, no rate limiting needed)
  ↓
PRD-7 (POSSE) - After PRD-6 complete (sets up POSSE platforms that need rate limiting)
  ↓
PRD-8 (Rate Limiting - This PRD) - After POSSE complete (prevents timeline spam when updating spreadsheet with recent content)
```

**Rationale**:
- PRD-6 (historical content) imports with cross-posting OFF, so no rate limiting needed
- PRD-7 (POSSE) enables fediverse and cross-posting to multiple platforms
- PRD-8 (rate limiting) prevents timeline spam on POSSE platforms when adding recent content
- Rate limiting only relevant after POSSE platforms configured (PRD-7)

## Design Decisions

### Decision 1: Rate Limiting for Recent Content Only
**Date**: 2025-10-19
**Status**: ✅ Confirmed

**Rationale**:
- Historical content (PRD-6) imported with cross-posting disabled (no syndication)
- No timeline spam risk for historical import (doesn't reach followers)
- Rate limiting only needed for recent content added after POSSE enabled
- Recent content syndicates to all platforms (fediverse, Bluesky, Flickr, LinkedIn)
- Flooding followers with recent content all at once creates poor experience

**Impact**:
- Rate limiting feature separate from PRD-6 (historical import)
- Rate limiting applies after PRD-7 (POSSE) complete
- Feature explicitly designed for ongoing spreadsheet maintenance, not one-time bulk import

### Decision 2: Hybrid Queue State (State File + Spreadsheet Visibility)
**Date**: 2025-10-19
**Status**: ✅ Recommended

**Rationale**:
- State file provides reliable system state (survives spreadsheet edits)
- Spreadsheet Column I provides user visibility (easy to see queue status)
- Hybrid approach combines best of both: reliable logic + transparent status
- Users can understand what's happening without inspecting state files
- System can reconcile discrepancies (state file is source of truth)

**Impact**:
- Milestone 1 creates state file structure
- Milestone 3 adds Column I for user visibility
- Sync script maintains both in sync

### Decision 3: Chronological Publishing Order
**Date**: 2025-10-19
**Status**: ✅ Confirmed

**Rationale**:
- Content should appear in natural chronological order by original date
- Publishing out of order confuses timeline and context
- Oldest content first maintains historical progression
- Matches user expectation (backfilling recent content, oldest→newest)

**Impact**:
- Queue sorts by Date column (ascending) before publishing
- Milestone 1 includes date parsing and sorting logic
- Queue state file stores date for reference

### Decision 4: Configurable Rate Limiting
**Date**: 2025-10-19
**Status**: ✅ Recommended

**Rationale**:
- Different scenarios need different rate limits (3 posts vs 10 posts)
- User preferences vary (some tolerate 2/day, others want 1/day)
- Threshold for triggering rate limiting should be configurable
- Interval between publishes should be configurable
- Flexibility more valuable than hardcoded defaults

**Impact**:
- Milestone 1 implements configuration parameters
- Default values: threshold=3, interval=24 hours, max_per_run=1
- Users can adjust via environment variables or config file

### Decision 5: Manual Override Capability
**Date**: 2025-10-19
**Status**: ✅ Confirmed

**Rationale**:
- Time-sensitive content needs bypass (breaking news, event announcements)
- User should control their publishing schedule, not be bound by automation
- Spreadsheet-based control (Column J) most accessible
- CLI force command useful for emergencies or queue clearing
- Trust user judgment over rigid automation

**Impact**:
- Milestone 3 adds Column J for priority control
- Milestone 4 implements override logic (immediate, hold, force-queue)
- Documentation emphasizes responsible use of overrides

## Progress Log

### 2025-10-19 (PRD Creation)
- **PRD Created**: Rate-limited publishing requirements gathered and documented
- **GitHub Issue**: [#8](https://github.com/wiggitywhitney/content-manager/issues/8) created
- **Key Decisions**: Hybrid state management, chronological ordering, configurable parameters, manual overrides
- **Scope Clarification**: Rate limiting for recent content only, not historical (PRD-6 has cross-posting disabled)
- **Dependencies Documented**: PRD-1 → PRD-6 → PRD-7 → PRD-8 (this PRD)
- **User Need**: Unblocks updating outdated spreadsheet with recent content without spamming followers

---

*This PRD will be updated as implementation progresses and requirements are refined.*

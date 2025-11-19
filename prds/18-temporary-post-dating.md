# PRD: Temporary Post Dating for Social Media Syndication

**Status**: In Progress
**Priority**: Medium
**GitHub Issue**: [#18](https://github.com/wiggitywhitney/content-manager/issues/18)
**Created**: 2025-01-18

---

## Problem Statement

When creating blog posts about past events (conferences, talks, etc.) with backdated timestamps, Micro.blog posts them at their historical date position in the feed. This causes social media syndication (Bluesky, Mastodon) to not pick up these posts, as cross-posting appears to only trigger for posts with current/recent dates.

**User Impact**: Content about recent events (e.g., last week's conference talk) doesn't reach social media audiences, reducing visibility and engagement for timely content.

**Current Behavior**:
- User creates row in spreadsheet with Column D = last week's date
- Script posts to Micro.blog with that backdated timestamp
- Post appears in historical position on blog
- Social media syndication does not trigger
- Missed opportunity for engagement

---

## Solution Overview

Implement a two-phase posting strategy:

**Phase 1 (Initial Sync)**: When posting content with a past date, create the post with TODAY's date to trigger Micro.blog's social media syndication.

**Phase 2 (Next Daily Sync)**: Detect posts where the published date doesn't match the intended date (Column D), and update them to the correct backdate after 24+ hours have passed.

**Result**: Content gets social media exposure when first posted, then moves to its proper chronological position in the blog archive.

---

## User Journey

### Before Feature
1. User adds row to spreadsheet: "My Conference Talk" dated January 10, 2025
2. Daily sync runs on January 17, 2025
3. Post created on Micro.blog with January 10 date
4. Post appears in blog at January 10 position (7 days back)
5. ❌ Social media syndication doesn't trigger
6. User's followers miss the announcement

### After Feature
1. User adds row to spreadsheet: "My Conference Talk" dated January 10, 2025
2. Daily sync runs on January 17, 2025
3. Post created on Micro.blog with **January 17 date** (today)
4. ✅ Post appears at top of blog feed
5. ✅ Social media syndication triggers → appears on Bluesky/Mastodon
6. User's followers see the announcement
7. Daily sync runs on January 18, 2025
8. Script detects date mismatch (Column D = Jan 10, Published = Jan 17)
9. Script updates post to January 10 date
10. Post moves to proper historical position in blog archive
11. Social media posts remain (mission accomplished)

---

## Technical Approach

### Detection Logic

**New Post Creation**:
- If Column D (intended date) < today → Create with TODAY's date
- If Column D = today → Create with today's date (normal flow)
- If Column D > today → Create with that future date (scheduled post)

**Existing Post Update**:
- Query post from Micro.blog via Micropub API
- Compare Column D with post's current `published` field
- If dates differ AND post URL was added to Column H 24+ hours ago → Update to Column D date

### Implementation Details

**API Operations**:
- Use existing `createMicroblogPost()` function with modified date logic
- Use existing `updateMicroblogPost()` function to change `published` field
- No delete/recreate needed - simple update operation

**Date Comparison**:
- Parse Column D date using existing `parseDateToISO()` function
- Extract date-only portions using `extractDateOnly()` for comparison
- Ignore time component (all dates normalized to 12:00:00Z)

**Timing Threshold**:
- Check if Column H (Micro.blog URL) exists
- If URL exists, post was created previously
- On next daily sync (24+ hours later), perform backdate update
- Keep it simple: "next daily run" approach, no complex timing

**URL Slug Handling**:
- Accept that URL will change when date updates: `/2025/01/17/post.html` → `/2025/01/10/post.html`
- Rely on existing slug regeneration logic to evolve timestamp URLs to title-based URLs over subsequent syncs
- No special handling needed initially - iterate if problems arise

### Edge Cases

**Daily Post Limit**: Script has 1-post-per-day limit. Multiple backdated posts will queue across multiple days (existing behavior, no change needed).

**Manual Today Posts**: If user manually adds row with Column D = today and genuinely wants today's date, it works correctly (posts with today's date).

**Future Dated Posts**: If Column D is in future, post created with future date (existing scheduled post behavior).

**Multiple Backdate Candidates**: If multiple posts need backdating on same sync, process all of them (no conflicts since they're updates, not creates).

---

## Success Criteria

### Must Have
- ✅ Posts with past dates in Column D initially publish with today's date
- ✅ Social media syndication triggers for these posts
- ✅ Posts automatically update to correct backdate on next daily sync
- ✅ URL changes are handled gracefully (no broken links in spreadsheet)
- ✅ No duplicate posts created

### Nice to Have
- 📊 Logging distinguishes between "initial temp-dated post" and "backdated update"
- 📊 Dry-run mode shows which posts would be backdated

### Non-Goals
- Custom timing thresholds (keeping simple: next daily sync)
- New spreadsheet columns for tracking (use existing data)
- Preventing URL changes (accepting this as trade-off)
- Immediate backdating (24-hour social syndication window is intentional)

---

## Validation Strategy

### Pre-Implementation Testing
Test current Micro.blog behavior to validate assumptions:
1. Create test post with today's date → verify social syndication triggers
2. Create test post with backdated date → verify social syndication does NOT trigger
3. Update existing post's `published` field → verify social syndication does NOT re-trigger

### Post-Implementation Testing
1. Add test row with past date to spreadsheet
2. Run sync → verify post created with today's date
3. Check social media → verify post appeared
4. Wait 24 hours, run sync again
5. Verify post updated to correct backdate
6. Verify URL updated in Column H
7. Verify no duplicate posts created

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Updating post date re-triggers social syndication (duplicate posts) | High | Low | Pre-validate with test post before implementation |
| URL changes break external links | Medium | Medium | Accept trade-off; external links are rare for recent posts |
| Backdating logic creates infinite update loop | High | Low | Careful comparison logic; only update if dates differ |
| Daily post limit prevents backdated posts from being created initially | Medium | Medium | Document behavior; this is existing limitation |
| Post gets backdated before social syndication completes | Medium | Low | 24-hour window should be sufficient; can increase if needed |

---

## Dependencies

**Internal**:
- Existing `createMicroblogPost()` function
- Existing `updateMicroblogPost()` function
- Existing `parseDateToISO()` date parser
- Existing `extractDateOnly()` date comparator
- Micropub API query capability for existing posts

**External**:
- Micro.blog's cross-posting behavior (validate via testing)
- Micro.blog's update operation stability

**No New Dependencies Required** ✅

---

## Implementation Milestones

### Milestone 1: Validate Assumptions
- [ ] Create test posts to validate cross-posting behavior
- [ ] Document findings on what triggers social syndication
- [ ] Confirm update operations don't re-trigger syndication

**Success Criteria**: Clear understanding of Micro.blog's cross-posting rules

---

### Milestone 2: Implement Temporary Dating Logic
- [x] Modify post creation flow to detect past dates
- [x] Post with today's date when Column D < today
- [x] Add logging to distinguish temp-dated posts
- [x] Test with dry-run mode

**Success Criteria**: New posts with past dates are created with today's date

---

### Milestone 3: Implement Backdate Detection & Update
- [x] Add logic to query existing post dates from Micro.blog
- [x] Compare Column D with published date
- [x] Detect posts that need backdating (date mismatch + 24hrs elapsed)
- [x] Update posts to correct backdate using `updateMicroblogPost()`
- [x] Update Column H with new URL if changed

**Success Criteria**: Posts automatically backdate on next sync after 24 hours

---

### Milestone 4: Testing & Validation
- [ ] End-to-end test with real post and social media verification
- [ ] Verify URL changes handled correctly
- [ ] Test multiple posts needing backdate simultaneously
- [ ] Verify no edge case issues (future dates, today dates, etc.)

**Success Criteria**: Feature works reliably for all date scenarios

---

### Milestone 5: Documentation & Launch
- [ ] Update repository documentation with new behavior
- [ ] Document URL change expectations
- [ ] Add troubleshooting section for common issues
- [ ] Feature ready for production use

**Success Criteria**: Feature documented and actively handling backdated posts

---

## Open Questions

1. **Syndication Timing**: Is 24 hours sufficient for all social platforms? (Can adjust if needed)
2. **URL Stability**: Will slug regeneration logic adequately handle evolving URLs? (Iterate if problems)
3. **Bulk Operations**: How does this interact with bulk-importing historical content? (Probably want different logic for bulk imports)

---

## Timeline Considerations

- Implementation can be done incrementally (milestone by milestone)
- Each milestone can be tested independently
- Feature can be deployed behind dry-run flag initially
- Low risk change - uses existing update mechanisms

---

## Metrics for Success

**Primary Metric**: Social media engagement on backdated posts (compare before/after)

**Secondary Metrics**:
- Number of posts successfully backdated per week
- URL changes that cause issues (support requests)
- Posts that fail to backdate (error logs)

---

## Future Enhancements (Not in Scope)

- Configuration option to disable feature for specific posts
- Custom backdate delay (instead of 24 hours)
- Bulk import mode that skips temporary dating
- Preserve original URL when backdating (requires more complex mp-slug logic)

---

## References

- [Micro.blog API Capabilities](../docs/microblog-api-capabilities.md) - Lines 695-710 (cross-posting uncertainty)
- [sync-content.js](../src/sync-content.js) - Lines 943-988 (updateMicroblogPost function)
- GitHub Issue [#18](https://github.com/wiggitywhitney/content-manager/issues/18)

# PRD: Link-Priority Content Publishing

**GitHub Issue**: [#20](https://github.com/wiggitywhitney/content-manager/issues/20)

**Status**: In Progress

**Priority**: Medium

---

## Problem Statement

Conference talks and other content often don't have links (videos, recordings) immediately available. The current publishing system uses pure chronological ordering (oldest first) without considering whether content has associated links.

This creates suboptimal social media posts where announcements lack meaningful URLs, reducing engagement and value. For example, posting "I gave a talk at KubeCon" is less valuable than "Here's my KubeCon talk: [video link]".

Content with videos/recordings should be prioritized over content still waiting for materials to be published.

## Solution Overview

Implement two-tier content selection logic that prioritizes content with links (Column G populated) while maintaining chronological fairness within each tier:

**Priority Tier 1**: Oldest content WITH links (Column G non-empty)
**Priority Tier 2**: Oldest content WITHOUT links (Column G empty)

Content in Tier 2 only gets published after ALL Tier 1 content is posted. This ensures social posts include meaningful URLs while giving older content a chance to accumulate videos/recordings before publication.

## User Experience

### Before
- System posts oldest unpublished content regardless of link availability
- Social posts might say "I gave a talk" without any link to actual content
- Content with immediately available videos might wait behind linkless content

### After
- System posts oldest content that HAS a link first
- Social posts consistently include URLs to actual content (videos, articles, recordings)
- When videos become available later, user adds link to Column G and content automatically moves to priority tier
- Linkless content still gets posted eventually (after all linked content)

### User Workflow
1. Add content to spreadsheet (Columns A-G)
2. If video/link available: populate Column G immediately → content enters Tier 1
3. If video/link not yet available: leave Column G empty → content enters Tier 2
4. When video becomes available later: add URL to Column G → content automatically moves to Tier 1 on next daily run
5. System handles prioritization automatically

## Technical Architecture

### Current Implementation
**File**: `src/sync-content.js` (lines 1257-1288)

**Current Algorithm**:
1. Filter unpublished content (Column H `microblogUrl` empty)
2. Sort by Column D (`date`) ascending (oldest first)
3. Select first item
4. Post if daily rate limit not exceeded

### Proposed Changes

**Modified Algorithm**:
1. Filter unpublished content (Column H `microblogUrl` empty)
2. **Partition into two tiers**:
   - Tier 1: Column G non-empty (has link)
   - Tier 2: Column G empty (no link)
3. **Sort each tier independently** by Column D ascending (oldest first)
4. **Combine**: Tier 1 items, then Tier 2 items
5. Select first item from combined list
6. Post if daily rate limit not exceeded

**Implementation Location**: `src/sync-content.js:1257-1288` (within `syncContent()` function)

**Code Strategy**:
```javascript
// Filter unpublished
const rowsToPost = validRows.filter(row => !row.microblogUrl);

// Partition by link presence
const withLinks = rowsToPost.filter(row => row.link);
const withoutLinks = rowsToPost.filter(row => !row.link);

// Sort each tier by date (oldest first)
const sortByDate = (a, b) => { /* existing sort logic */ };
withLinks.sort(sortByDate);
withoutLinks.sort(sortByDate);

// Combine: Tier 1, then Tier 2
const prioritizedRows = [...withLinks, ...withoutLinks];

// Select oldest from prioritized list
const oldestRow = prioritizedRows[0];
```

### Design Decisions

**1. URL Validation**: **No validation**
- Current system doesn't validate URLs
- Simple truthy/falsy check on Column G
- Broken links discovered when posts go live (user can fix manually)
- Avoids complexity: network calls, timeouts, intermittent failures

**2. Wait Time**: **No maximum/minimum**
- Linkless content waits until ALL linked content is posted
- No artificial time limits
- Dynamic: adding link to Column G automatically re-prioritizes content

**3. Content Type Handling**: **All types follow same logic**
- Presentations (currently allow empty links) also prioritized by link presence
- Presentation recordings (with links) post before in-person-only talks (no links)
- Consistent behavior across all content types

**4. Backward Compatibility**:
- Changes publishing order for currently queued content
- Linkless content that was "next up" will be delayed
- Aligns with feature goals (prioritize linked content)

## Success Criteria

**Functional**:
- ✅ Content with links (Column G non-empty) posts before content without links
- ✅ Within each tier, chronological ordering maintained (oldest first)
- ✅ Adding link to Column G re-prioritizes content automatically on next daily run
- ✅ All content types (Podcast, Video, Blog, Presentations, Guest) follow same logic
- ✅ Daily rate limiting still enforced (1 post per day)
- ✅ Existing dual-post strategy for backdated content still works

**User Value**:
- Social posts consistently include meaningful URLs to actual content
- Conference talk videos get posted when available (not weeks/months later)
- User can control priority by managing Column G values in spreadsheet

**Testing Validation**:
- Correctly prioritizes content with links over content without links
- Maintains chronological ordering within each tier
- Handles edge cases: all linked, all linkless, mixed dates, empty Column G values

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Publishing order change delays some queued content | Low | Expected behavior; aligns with feature goals |
| Empty string vs null/undefined handling | Low | JavaScript truthy/falsy check handles all cases |
| User confusion about why content not posting | Medium | README documentation explains two-tier logic |

## Dependencies

**None** - Self-contained change to existing selection logic in `src/sync-content.js`

## Milestones

- [x] **Core prioritization logic implemented**: Two-tier sorting (with links, then without links) working in `sync-content.js`
- [x] **Edge cases validated**: All linked, all linkless, mixed dates, empty values handled correctly
- [x] **Integration testing complete**: Daily workflow runs successfully with new logic, dual-post strategy unaffected
- [x] **Documentation updated**: README reflects new selection behavior and user workflow
- [ ] **Feature deployed and validated**: Production runs demonstrate correct prioritization, social posts include links

## Implementation Plan

### Phase 1: Core Implementation
- Modify selection logic in `src/sync-content.js:1257-1288`
- Implement two-tier partitioning (with/without links)
- Maintain chronological sorting within each tier
- Test locally with sample data

### Phase 2: Validation & Testing
- Test edge cases: all content with links, all without, mixed scenarios
- Verify dual-post strategy (backdated content) still works correctly
- Confirm daily rate limiting unaffected
- Validate sort stability for same dates

### Phase 3: Documentation & Deployment
- Update README with new selection behavior
- Document user workflow (when to populate Column G)
- Deploy to production
- Monitor first few daily runs for correct behavior

## Open Questions

_None at this time._

## Progress Log

### 2025-11-20
- PRD created
- Requirements finalized with user
- Technical approach defined (two-tier sorting)
- Design decisions documented (no URL validation, no wait times, all content types)
- Implementation started: created feature branch `feature/prd-20-link-priority-publishing`
- **Implementation Complete** (Duration: ~2 hours, Commit: 9bca543):
  - Core two-tier sorting logic implemented in `src/sync-content.js:1262-1301`
  - Partitions unpublished content by link presence (Column G)
  - Sorts each tier independently by date (oldest first)
  - Combines tiers: Tier 1 (with links) first, then Tier 2 (without links)
  - Enhanced logging to show priority tier selection and link URLs
  - DRY_RUN testing validated correct behavior:
    - Selected content with link (10/22/2025) over older content without links (05/05, 09/06, 10/07, 10/08)
    - Chronological ordering maintained within tiers
    - Daily rate limiting and guard logic unaffected
- **Documentation Complete**:
  - Updated README with succinct link-priority explanation
  - Added to Key Features list
  - Documented selection behavior in Content Sync section
  - Explained Column G workflow in Spreadsheet Workflow section
- **Next Steps**: Deploy to production and validate

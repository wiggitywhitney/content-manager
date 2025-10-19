# PRD: Historical Content Spreadsheet Integration

**Issue**: [#6](https://github.com/wiggitywhitney/content-manager/issues/6)
**Status**: Planning
**Priority**: Medium
**Created**: 2025-10-19
**Last Updated**: 2025-10-19

## Problem Statement

Whitney has 4 historical content tracking spreadsheets covering 2022-2024 that are separate from the current automated content publishing system (PRD #1). This historical content represents significant past work but is:

- **Isolated**: Not integrated with current Micro.blog automation
- **Inconsistently formatted**: Different column structures, title hyperlinks instead of URL columns
- **Selectively valuable**: Some content should be included (e.g., 4 key items from 2022), others may not (defunct VMware blog posts)
- **Manually managed**: No automated sync, requiring manual decisions about inclusion

## Solution Overview

Integrate historical spreadsheets into the automated content publishing system, handling format differences and enabling selective content inclusion. The solution must address:

1. **Format normalization**: Transform different spreadsheet structures into compatible format
2. **Selective inclusion**: Enable filtering/selection of which content to publish
3. **Integration approach**: Decide between consolidating into single source-of-truth vs. multi-spreadsheet architecture
4. **Content validation**: Handle edge cases like missing URLs, defunct links, conference pages

## Historical Spreadsheet Inventory

### Spreadsheet Sources
1. **2022 Content**: [Spreadsheet Link](https://docs.google.com/spreadsheets/d/1y5oxniWuw2R4UOOL00_oEQ1xRO1uaQPIQbvG_nt7vXc/edit?usp=sharing)
   - Estimated inclusion: ~4 key items
   - Format: Title hyperlinks (not separate URL column)

2. **2023 Content**: [Spreadsheet Link](https://docs.google.com/spreadsheets/d/1pwJz_r91m_zJWOI6XuqsMRQpwLnxAN32j-aIiJYuZm0/edit?usp=sharing)
   - Format: Title hyperlinks

3. **2024 Content (Spreadsheet 1)**: [Spreadsheet Link](https://docs.google.com/spreadsheets/d/1nz_v9_WfFanJcvC5WRcZ6S9JPLSGlYdwsyzRxNUGjjE/edit?usp=sharing)
   - Format: Title hyperlinks

4. **2024 Content (Spreadsheet 2)**: [Spreadsheet Link](https://docs.google.com/spreadsheets/d/1m7DTzOMu3Bkba8Mp3z4mDL0BVyJTCuYWrc20GlsmIrs/edit?usp=sharing)
   - Format: Title hyperlinks

### Known Format Differences
- **URL Storage**: Historical sheets use title hyperlinks instead of dedicated URL column
- **Link Quality**: Some titles link to conference webpages rather than actual content
- **Content Availability**: Some content may no longer be online (e.g., VMware blog → Broadcom transition)
- **Column Structure**: TBD (requires detailed analysis)

## Open Questions & Decision Points

These questions require user decisions before implementation:

### 1. Architecture Decision
**Question**: Should we consolidate all content into the single source-of-truth spreadsheet, or support multiple spreadsheets as separate sources?

**Option A: Single Source of Truth (Consolidation)**
- **Pros**: Simple architecture, single sync script, unified view
- **Cons**: One-time migration work, loses historical organization, larger spreadsheet

**Option B: Multi-Spreadsheet Architecture**
- **Pros**: Preserves historical organization, can apply different rules per sheet
- **Cons**: More complex sync logic, multiple state tracking, harder to query across years

**Option C: Hybrid Approach**
- **Pros**: Selective migration (only chosen items moved to main sheet)
- **Cons**: Fragmented data, still requires multi-spreadsheet support for archives

**Option D: Single Spreadsheet with Multiple Tabs**
- **Pros**: Single source of truth, preserves historical organization by year, simpler than multi-file approach
- **Cons**: Sync script reads multiple tabs (moderate complexity increase), larger single file

**Decision**: [To be determined]

### 2. Selective Inclusion Strategy
**Question**: How should we decide which historical content to include?

**Approach Options**:
- **Manual Marking**: Add "Include" column to historical sheets, Whitney marks desired rows
- **Rule-Based Filtering**: Automated criteria (e.g., only Podcast/Presentation types, only items with valid URLs)
- **Review Workflow**: System suggests candidates, Whitney approves/rejects
- **Bulk Import + Manual Cleanup**: Import everything, remove unwanted posts via spreadsheet deletion

**Decision**: [To be determined]

### 3. Defunct Content Handling
**Question**: Should we include content that's no longer accessible online (e.g., VMware blog posts)?

**Considerations**:
- Historical record value vs. broken links
- Micro.blog post format (could note "archived" or "no longer available")
- Future content preservation strategy (Internet Archive, personal backups)

**Decision**: [To be determined]

### 4. URL Extraction from Hyperlinks
**Question**: How to handle title hyperlinks that point to conference pages instead of actual content?

**Approach Options**:
- **Skip**: Ignore rows where hyperlink isn't direct content URL
- **Extract**: Use conference page URL as placeholder
- **Manual Cleanup**: Require URL correction before import
- **Smart Detection**: Parse hyperlink, flag suspected non-content URLs for review

**Decision**: [To be determined]

### 5. Migration Timing
**Question**: Should historical content integration happen before or after PRD #1 Milestones 5-8 complete?

**Considerations**:
- PRD #1 establishes core CRUD functionality needed for this work
- Historical integration could inform multi-spreadsheet architecture decisions
- Delaying reduces scope creep, completing earlier provides comprehensive content view

**Decision**: [To be determined]

## Technical Requirements

### Format Normalization Needs
- [ ] Analyze all 4 spreadsheet structures (column names, data types, formats)
- [ ] Extract URLs from title hyperlinks programmatically
- [ ] Map historical Type values to standardized taxonomy (Podcast, Video, Blog, Presentation, Guest)
- [ ] Handle missing required fields (Date, Type, Link)
- [ ] Detect and flag low-quality links (conference pages, defunct URLs)

### Integration Options
- [ ] **Option A**: Append historical rows to main spreadsheet (one-time migration)
- [ ] **Option B**: Extend sync script to read multiple spreadsheets (ongoing multi-source)
- [ ] **Option C**: Manual curation into dedicated "Archive" tab in main spreadsheet
- [ ] **Option D**: Consolidate into tabs within single source-of-truth spreadsheet

### Selective Inclusion Mechanism
- [ ] Add "Include" column to historical sheets (if manual marking approach chosen)
- [ ] Implement filtering logic in sync script
- [ ] Support dry-run preview of what would be imported
- [ ] Enable incremental imports (partial backfill)

### Content Validation
- [ ] URL accessibility checking (HTTP status codes)
- [ ] Link quality scoring (direct content vs. conference/blog homepage)
- [ ] Duplicate detection (across historical + current spreadsheets)
- [ ] Date parsing for various historical formats

## User Experience

### Current State
1. Historical content exists only in separate spreadsheets
2. No visibility on Micro.blog site
3. Manual effort required to reference or share old work

### Desired State
1. Selected historical content visible on Micro.blog categories
2. Unified view of all Whitney's content (current + historical)
3. Clear indication of which historical items are included/excluded
4. Easy way to add more historical content over time

## Implementation Approach

*To be refined after open questions are resolved*

### Potential Milestone Outline

#### Milestone 1: Historical Spreadsheet Analysis
- Detailed analysis of all 4 spreadsheet formats
- Document column mappings and format differences
- Identify data quality issues and edge cases
- Create format normalization specification

#### Milestone 2: URL Extraction & Validation
- Implement hyperlink extraction from title cells
- Build URL validation and quality scoring
- Generate report of accessible vs. defunct content
- Flag low-quality links for manual review

#### Milestone 3: Selective Inclusion Implementation
- Implement chosen inclusion strategy (manual marking, rules, etc.)
- Create preview/dry-run functionality
- Enable filtering by year, type, quality score
- Document inclusion decision rationale

#### Milestone 4: Integration Architecture
- Implement chosen architecture (consolidation vs. multi-spreadsheet vs. multi-tab)
- Update sync script to handle historical formats
- Add state tracking for historical content
- Test with small subset of historical data

#### Milestone 5: Historical Content Backfill
- Execute one-time migration or enable ongoing sync
- Validate posts created correctly on Micro.blog
- Verify chronological ordering (published dates)
- Document any manual cleanup needed

#### Milestone 6: Documentation & Maintenance
- Document historical integration process
- Create guidelines for future historical additions
- Update main PRD #1 if architecture changes needed
- Close out open questions and record final decisions

## Dependencies & Risks

### External Dependencies
- **PRD #1 Completion**: Requires CRUD operations (Milestones 5-8) for full functionality
- **Spreadsheet Access**: Service account needs read access to 4 historical spreadsheets
- **Historical Data Quality**: Depends on accuracy and completeness of old records

### Technical Risks
- **Format Complexity**: Historical sheets may have unexpected format variations
- **URL Extraction Accuracy**: Hyperlink parsing may miss or misinterpret URLs
- **Data Volume**: Large historical backfill could hit API rate limits or timeout
- **Duplicate Detection**: Same content might exist in multiple sheets

### Decision Risks
- **Scope Creep**: Supporting multiple formats could significantly expand complexity
- **Rework Risk**: Architectural decisions made now may need revision based on PRD #1 learnings
- **Selective Inclusion Burden**: Manual marking could become tedious for large datasets

### Mitigation Strategies
- **Phase Approach**: Start with single spreadsheet (2022) as pilot, iterate on learnings
- **Dry-Run First**: Always preview changes before committing to Micro.blog
- **Incremental Import**: Support partial imports to manage API limits and manual review burden
- **Architecture Flexibility**: Design sync script with pluggable format adapters for future formats

## Success Criteria

The feature is complete when:
1. ✅ All 4 historical spreadsheets analyzed and format differences documented
2. ✅ Open questions answered with clear decisions recorded in PRD
3. ✅ URL extraction working correctly from title hyperlinks
4. ✅ Selective inclusion mechanism implemented and tested
5. ✅ Historical content successfully synced to Micro.blog
6. ✅ Published posts appear in correct chronological order
7. ✅ Process documented for adding more historical content in future

## Design Decisions

### Decision 1: Create Separate PRD for Historical Integration
**Date**: 2025-10-19
**Rationale**:
- Historical integration is distinct from core automation (PRD #1)
- Different format handling and selective inclusion concerns
- Allows PRD #1 to complete without scope creep
- Can leverage PRD #1's CRUD functionality once stable

**Impact**:
- Clearer separation of concerns
- PRD #1 remains focused on core automation
- Historical integration can start planning while PRD #1 in progress
- Enables parallel design discussion without blocking implementation

## Progress Log

### 2025-10-19 (PRD Creation)
- **Issue Created**: [#6](https://github.com/wiggitywhitney/content-manager/issues/6)
- **PRD File Created**: `prds/6-historical-content-integration.md`
- **Status**: Planning phase - open questions identified
- **Next Steps**:
  1. Analyze historical spreadsheet formats in detail
  2. Make architecture decision (consolidation vs. multi-spreadsheet vs. multi-tab)
  3. Choose selective inclusion strategy
  4. Wait for PRD #1 Milestone 5 completion (CRUD operations needed)

---

*This PRD will be updated as decisions are made and implementation progresses.*

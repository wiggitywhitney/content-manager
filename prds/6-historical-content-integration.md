# PRD: Historical Content Spreadsheet Integration

**Issue**: [#6](https://github.com/wiggitywhitney/content-manager/issues/6)
**Status**: Complete
**Priority**: Medium
**Created**: 2025-10-19
**Last Updated**: 2025-10-25

## Problem Statement

Whitney has 4 historical content tracking spreadsheets covering 2022-2024 that are separate from the current automated content publishing system (PRD #1). This historical content represents significant past work but is:

- **Isolated**: Not integrated with current Micro.blog automation
- **Inconsistently formatted**: Different column structures, title hyperlinks instead of URL columns
- **Selectively valuable**: Some content should be included (e.g., 4 key items from 2022), others may not (defunct VMware blog posts)
- **Manually managed**: No automated sync, requiring manual decisions about inclusion

## Solution Overview

Integrate historical content into the current 2025 spreadsheet as separate yearly tabs, handling format differences and enabling selective content inclusion. The solution addresses:

1. **Architecture**: Single spreadsheet with multiple tabs (Sheet1 + yearly tabs: 2024, 2023, 2022)
2. **Format normalization**: Transform different spreadsheet structures into compatible format
3. **Selective inclusion**: Enable filtering/selection of which content to publish per milestone
4. **Content validation**: Handle edge cases like missing URLs, defunct links, conference pages
5. **Phased approach**: Each year is a completely separate milestone with its own strategy

**Key Decision**: Use single spreadsheet with yearly tabs. Current content remains in `Sheet1`, historical content imported to tabs `2024`, `2023`, `2022`. No annual setup required - Sheet1 continues to accumulate content indefinitely.

## Current 2025 Spreadsheet (Target)

**Spreadsheet**: 2025_Content_Created
- **URL**: https://docs.google.com/spreadsheets/d/1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs
- **Current Tab**: `Sheet1` (ongoing 2025+ content)
- **Historical Tabs** (to be created): `2024`, `2023`, `2022`

## Content Sources by Year

### 2024 Sources
**Spreadsheets:**
1. **2024_Work_Details** - https://docs.google.com/spreadsheets/d/1m7DTzOMu3Bkba8Mp3z4mDL0BVyJTCuYWrc20GlsmIrs
   - 7 columns: NAME, CONTENT TYPE, EXPORT INDICATOR, DATE, CONTENT LINK, EYEBALLS LIVE, EYEBALLS POST
   - ~116 rows (mostly Enlightning live streams)
   - URLs in hyperlinks (CONTENT LINK column)
   - Needs Aug-Dec 2024 updates

2. **2024_Events** - https://docs.google.com/spreadsheets/d/1nz_v9_WfFanJcvC5WRcZ6S9JPLSGlYdwsyzRxNUGjjE
   - 18 columns: NAME, EVENT TYPE, EXPORT INDICATOR, LOCATION TYPE, LOCATION, STATUS, REGION, DATE, END DATE, TIME, NOTES, CONTENT LINK, etc.
   - ~61 rows (conferences, webinars, podcasts)
   - URLs in hyperlinks (NAME and CONTENT LINK columns)
   - Has "EXPORT INDICATOR" for filtering

3. **2024 ⚡️ Enlightning Tracking** - https://docs.google.com/spreadsheets/d/1u-ucdeqU5h8MBmDyXr3MM1UhRfcSsPXWRcWKEKqg8L4
   - Helper sheet with Aug-Dec content
   - May be easier to extract from playlists instead (see below)

**YouTube Playlists (Alternative/Supplementary Sources):**
- **You Choose!** - https://www.youtube.com/playlist?list=PLyicRj904Z9-FzCPvGpVHgRQVYJpVmx3Z
- **⚡️ Enlightning** - https://www.youtube.com/playlist?list=PLBexUsYDijaz09nH8BVPmPio_16V115i4
- **Software Defined Interviews** - https://www.softwaredefinedinterviews.com (Whitney joined at episode 83: https://www.softwaredefinedinterviews.com/83)
- **Presentations & Guest Appearances** - https://www.youtube.com/playlist?list=PLBexUsYDijaywlq2e_fI73memzeg4UMzA

### 2023 Sources
**Spreadsheet:**
1. **2023 Content** - https://docs.google.com/spreadsheets/d/1pwJz_r91m_zJWOI6XuqsMRQpwLnxAN32j-aIiJYuZm0
   - 14 columns: Event, Type of content or engagement, Start Date, End Date, Location, Confirmed, Speaking Engagement, Talk, Time, Opportunity #, Travel Out, Travel back, Eyeballs, Video
   - ~63 rows (conferences, podcasts, streaming shows)
   - URLs in hyperlinks (Event and Video columns)

**Note**: May include "2023_Work_Details + Enlightnings" - to be clarified during Milestone 3 implementation

**YouTube Playlists** (can be used to verify completeness):
- Software Defined Interviews (ep 83+)
- ⚡️ Enlightning playlist (check for 2023 episodes)

### 2022 Sources
**Spreadsheet:**
1. **2022 Content** - https://docs.google.com/spreadsheets/d/1y5oxniWuw2R4UOOL00_oEQ1xRO1uaQPIQbvG_nt7vXc
   - 13 columns: Event, Type, Location, Start Date, End Date, Confirmed, Speaking Engagement, Talk, Time, Travel Out, Travel back, Eyeballs, Video
   - ~94 rows (conferences, holidays, personal time, streaming shows)
   - URLs in hyperlinks (Event and Video columns)
   - Estimated inclusion: ~4 key items
   - Mix of publishable content and non-content events

### Additional Sources
**IBM Videos (7 videos):**
- YouTube Playlist: https://www.youtube.com/playlist?list=PLBexUsYDijaz14Mot8_6rAbxkoF4iS6PZ
- Dedicated milestone for extraction and integration

### Format Analysis Summary
**Common Format Differences Across Years:**
- **URL Storage**: All historical sheets use title hyperlinks instead of dedicated URL columns
- **Column Structure**: Each year has completely different column names and organization
- **Content Mix**: 2022-2023 mix events with actual content; 2024 more focused on publishable content
- **Filtering Indicators**: 2024 sheets have "EXPORT INDICATOR" column; earlier years do not
- **Month Headers**: All sheets have month header rows (e.g., "January") that need to be skipped

## Design Decisions

### Decision 1: Create Separate PRD for Historical Integration
**Date**: 2025-10-19
**Status**: ✅ Confirmed

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

### Decision 2: Single Spreadsheet with Yearly Tabs Architecture
**Date**: 2025-10-24
**Status**: ✅ Confirmed

**Rationale**:
- Single source of truth for all content (current + historical)
- Preserves historical organization by year (tabs: 2024, 2023, 2022)
- Simpler than multi-file approach (one spreadsheet ID to manage)
- No annual setup burden - Sheet1 continues indefinitely for ongoing content
- Moderate sync script complexity (reads multiple tabs instead of multiple files)

**Impact**:
- Target spreadsheet: 2025_Content_Created (ID: 1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs)
- Current content: `Sheet1` tab (ongoing)
- Historical tabs: `2024`, `2023`, `2022` (created during respective milestones)
- Sync script will need multi-tab reading capability
- All content in one place for unified management

### Decision 3: One Year at a Time - Separate Milestone per Year
**Date**: 2025-10-24
**Status**: ✅ Confirmed

**Rationale**:
- Each year has completely different spreadsheet formats
- Prevents overwhelm by tackling manageable chunks
- Allows learning from each milestone before proceeding
- Each year requires unique strategy for filtering, extraction, and normalization
- Flexibility to adjust approach based on learnings

**Impact**:
- 5 completely separate milestones (2024 Work_Details, 2024 Events, 2023, 2022, IBM videos)
- Each milestone is self-contained: plan → implement → document learnings → next milestone
- Specific questions (filtering, data sources, etc.) deferred to implementation time
- Year-specific decisions captured in each milestone, not upfront

### Decision 4: Extract-First Strategy - All Data Extraction Before Google Sheets Import
**Date**: 2025-10-25
**Status**: ✅ Confirmed

**Rationale**:
- Avoids multiple imports to same yearly tabs (reduces rework and potential errors)
- Enables comprehensive deduplication across ALL sources before import
- Single import → test → approve workflow is cleaner than multiple append cycles
- All 2024 content (playlists + events spreadsheet) merged into one complete `2024` tab
- Same benefit applies to 2023 and 2022 tabs

**Impact**:
- **Phase A (Extraction)**: Milestones 6.1-6.4 focus on extracting data to FINAL CSVs only
- **Phase B (Import)**: New Milestone 6.6 handles ONE comprehensive import of all tabs
- Milestone 6.1 extraction = ✅ COMPLETE (234 videos from playlists)
- Milestone 6.2: Extract 2024_Events spreadsheet → merge with FINAL-2024.csv
- Milestone 6.3: Extract 2023 spreadsheet → merge with FINAL-2023.csv
- Milestone 6.4: Extract 2022 spreadsheet → merge with FINAL-2022.csv
- Milestone 6.5: IBM videos already extracted (included in 6.1)
- Milestone 6.6: Import ALL FINAL CSVs to Google Sheets tabs in one operation

## Open Questions (Deferred to Implementation)

The following questions will be answered during each milestone's implementation phase:

### Per-Milestone Decisions (Not Decided Upfront)
- **Data source selection**: Use spreadsheets vs. YouTube playlists vs. hybrid approach?
- **Selective inclusion strategy**: Manual marking, rule-based filtering, or bulk import + cleanup?
- **URL extraction approach**: Handle hyperlinks from various column locations
- **Content type mapping**: Map historical types to current taxonomy (Podcast, Video, Blog, Presentations, Guest)
- **Filtering criteria**: Use EXPORT INDICATOR? Skip non-content rows (holidays, personal time)?
- **Defunct content handling**: Include content with broken/outdated URLs?

### Cross-Year Consistency Questions
- **YouTube playlists for verification**: Should playlists be used to verify spreadsheet completeness across all years (2022-2025)?
- **Missing content detection**: How to identify content gaps between sources?
- **Duplicate detection**: How to handle same content appearing in multiple sources?

## Technical Requirements

### Format Normalization Needs
- [x] Analyze all 4 spreadsheet structures (column names, data types, formats) → **Decision: Used YouTube playlists instead**
- [x] Extract URLs from sources programmatically → **yt-dlp metadata extraction + SDI website scraping**
- [x] Map historical Type values to standardized taxonomy (Podcast, Video, Blog, Presentation, Guest) → **Implemented in process-youtube-playlist.js**
- [x] Handle missing required fields (Date, Type, Link) → **NEEDS_REVIEW for Presentations & Guest, manual classification**
- [x] Detect and flag low-quality links (conference pages, defunct URLs) → **Manual review via NEEDS_REVIEW tab**

### Integration Options
- [ ] **Option A**: Append historical rows to main spreadsheet (one-time migration)
- [ ] **Option B**: Extend sync script to read multiple spreadsheets (ongoing multi-source)
- [ ] **Option C**: Manual curation into dedicated "Archive" tab in main spreadsheet
- [x] **Option D**: Consolidate into tabs within single source-of-truth spreadsheet → **Selected: FINAL CSVs ready for yearly tab import**

### Selective Inclusion Mechanism
- [ ] Add "Include" column to historical sheets (if manual marking approach chosen)
- [ ] Implement filtering logic in sync script
- [ ] Support dry-run preview of what would be imported
- [ ] Enable incremental imports (partial backfill)

### Content Validation
- [ ] URL accessibility checking (HTTP status codes)
- [ ] Link quality scoring (direct content vs. conference/blog homepage) → **Manual review via NEEDS_REVIEW tab**
- [x] Duplicate detection (across historical + current spreadsheets) → **Implemented: title+date normalization, found 14 duplicates**
- [x] Date parsing for various historical formats → **Implemented: M/D/YYYY + ordinal dates (1st, 2nd, 3rd)**

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

## Implementation Milestones

### Milestone Structure

**Two-Phase Approach** (Decision 4):
- **Phase A - Data Extraction (Milestones 6.1-6.4)**: Extract all historical content to FINAL CSVs
- **Phase B - Import to Google Sheets (Milestone 6.6)**: ONE comprehensive import of all yearly tabs

Each extraction milestone is a **separate effort**. Complete one milestone fully (extract → merge → document learnings) before starting the next.

**Cross-posting**: All historical content imported with **cross-posting disabled** (consistent with PRD-6 original approach) to avoid spamming followers with old content.

---

### Milestone 6.1: YouTube Playlist Extraction (PHASE A)

**Goal**: Extract 2024 work/content details (primarily Enlightning streams) from YouTube playlists to FINAL CSVs

**Status**: ✅ EXTRACTION COMPLETE

**Sources**:
- Primary: 2024_Work_Details spreadsheet (116 rows, 7 columns)
- Helper: 2024 ⚡️ Enlightning Tracking spreadsheet (Aug-Dec updates)
- Alternative: Extract from YouTube playlists (You Choose!, ⚡️ Enlightning)

**Decision Record** (resolved 2025-10-25):
- ✅ **Data source**: YouTube playlists chosen (yt-dlp extraction)
- ✅ **EXPORT INDICATOR**: N/A (didn't use spreadsheets)
- ✅ **Content inclusion**: All videos from playlists included (220 total historical videos 2020-2024)
- ✅ **Aug-Dec gap**: Playlists provided complete data
- ✅ **Content type mapping**:
  - ⚡️Enlightning, You Choose!, Cloud Native Live → "Video"
  - Software Defined Interviews → "Podcast" (episodes 83-111 scraped from website)
  - Presentations & Guest → "NEEDS_REVIEW" (manual classification via spreadsheet tab)
  - IBM Cloud → "Video"
- ✅ **Show name formatting**: ⚡️Enlightning (no space between emoji and text), IBM Cloud (renamed from IBM Videos)

**Success Criteria** (Extraction Phase):
- [x] 2024 work/content data extracted from YouTube playlists (111 videos for 2024)
- [x] Additional years extracted: 2020 (4), 2021 (3), 2022 (33), 2023 (83)
- [x] Data normalized to compatible format (Name, Type, Date, Link columns)
- [x] NEEDS_REVIEW tab created for manual classification (46 Presentations & Guest videos)
- [x] Software Defined Interviews episodes 83-111 scraped with correct URLs (softwaredefinedinterviews.com/{episode})
- [x] Deduplication logic implemented (found 14 unique videos in Enlightning alternate playlist)
- [x] Year filtering implemented (2025 content automatically excluded)
- [x] FINAL CSVs generated (6 files: by year + combined)
- [x] **Completeness verification**: ✅ 2024_Work_Details spreadsheet 100% extracted (55/56 videos - 1 inaccessible/deleted)
- [x] Enlightning title cleanup (removed prefix variations)
- [x] NEEDS_REVIEW corrections applied (62 manual classifications imported)
- [x] Additional playlists integrated (Two Friends Talking Tanzu, VMware Tanzu YouTube)
- [x] Blog posts tracked separately (other-content-2024.csv)
- [x] Final data statistics: 234 total videos (2020: 4, 2021: 3, 2022: 33, 2023: 83, 2024: 111)
- [x] Learnings documented

**Note**: Google Sheets import deferred to Milestone 6.6 (after all extractions complete)

---

### Milestone 6.2: 2024_Events Spreadsheet Extraction (PHASE A)

**Goal**: Extract 2024 events (conferences, webinars, podcasts) from spreadsheet and merge with FINAL-2024.csv

**Status**: ✅ COMPLETE

**Sources**:
- Primary: 2024_Events spreadsheet (61 rows, 18 columns) - https://docs.google.com/spreadsheets/d/1nz_v9_WfFanJcvC5WRcZ6S9JPLSGlYdwsyzRxNUGjjE
- Supplementary: Presentations & Guest Appearances playlist (verification/deduplication)

**Decision Record** (resolved 2025-10-25):
- ✅ **Extraction method**: Manual selection (not full programmatic extraction)
- ✅ **EXPORT INDICATOR**: Not used - user manually selected items
- ✅ **Event types included**: Guest appearances, presentations, podcasts, blog posts (12 items)
- ✅ **URL extraction**: Manual - users provided links directly
- ✅ **Content type mapping**: User specified type for each item (Guest, Presentations, Blog)
- ✅ **Deduplication**: Manual review - no duplicates found

**Success Criteria** (Extraction Phase):
- [x] 2024_Events data extracted from spreadsheet (12 items manually added)
- [x] Event types mapped to standard taxonomy (Guest, Presentations, Blog)
- [x] Duplicates detected (manual review - none found)
- [x] Data merged into FINAL-2024.csv (122 videos, up from 111)
- [x] FINAL-ALL-HISTORICAL-2020-2024.csv regenerated (245 videos total)
- [x] Learnings documented

**Note**: Google Sheets import deferred to Milestone 6.6 (after all extractions complete)

---

### Milestone 6.3: 2023 Content Spreadsheet Extraction (PHASE A)

**Goal**: Extract 2023 content from spreadsheet and merge with FINAL-2023.csv

**Status**: ✅ COMPLETE

**Sources**:
- Primary: 2023 Content spreadsheet (63 rows, 14 columns) - https://docs.google.com/spreadsheets/d/1pwJz_r91m_zJWOI6XuqsMRQpwLnxAN32j-aIiJYuZm0
- Supplementary: Tanzu Tuesdays playlist (11 videos from 2021-2022)

**Decision Record** (resolved 2025-10-25):
- ✅ **Extraction method**: Manual selection (user-provided items marked "ADD" in spreadsheet)
- ✅ **Data source**: User manually reviewed spreadsheet and selected 20 items for extraction
- ✅ **URL extraction**: Manual - user provided links directly after reviewing each item
- ✅ **Content type mapping**: User specified type for each item (Guest, Presentations, Video, Blog)
- ✅ **Deduplication**: Manual review + merge script caught duplicates (5 items skipped)
- ✅ **Tanzu Tuesdays playlist**: Extracted separately, integrated into merge pipeline

**Success Criteria** (Extraction Phase):
- [x] 2023 content data extracted from spreadsheet (16 items manually added: 14 to 2023, 1 to 2024, 1 duplicate)
- [x] Tanzu Tuesdays playlist extracted (11 videos: 4 from 2021, 7 from 2022)
- [x] Content types mapped to standard taxonomy (Guest, Presentations, Video, Blog, Podcast)
- [x] Duplicates detected (5 items skipped: duplicates, taken down, or wrong year)
- [x] Data merged into FINAL-2023.csv (99 videos total, up from 84 - added 15 items)
- [x] FINAL-2024.csv updated (123 videos, up from 122 - added 1 Intel Developer blog)
- [x] FINAL-ALL-HISTORICAL-2020-2024.csv regenerated (273 videos total, up from 257)
- [x] Learnings documented
- [x] Applied lessons from Milestones 6.1 and 6.2 (manual extraction approach)

**Note**: Google Sheets import deferred to Milestone 6.6 (after all extractions complete)

---

### Milestone 6.4: 2022 Content Spreadsheet Extraction (PHASE A)

**Goal**: Extract ~4 key items from 2022 spreadsheet and merge with FINAL-2022.csv

**Status**: ✅ COMPLETE

**Sources**:
- Primary: 2022 Content spreadsheet (94 rows, 13 columns) - https://docs.google.com/spreadsheets/d/1y5oxniWuw2R4UOOL00_oEQ1xRO1uaQPIQbvG_nt7vXc
- Actual: 16 items manually selected and added (14 to 2022, 1 to 2021, 1 to 2024)

**Decision Record** (resolved 2025-10-25):
- ✅ **Extraction method**: Manual selection (user marked 13 items with "ADD" in spreadsheet)
- ✅ **Data source**: User manually reviewed 94-row spreadsheet, selected specific presentations and blogs
- ✅ **URL extraction**: Manual - user provided links, verified each one
- ✅ **Content type mapping**: Presentations (11), Guest (1), Blog (2)
- ✅ **Link verification**: All YouTube links tested with yt-dlp, one VMware link broken (404)
- ✅ **Deduplication**: Merge script deduplicated (76 total → 54 unique in 2022)
- ✅ **Date corrections**: Found 2 blog posts with wrong years in spreadsheet (moved to correct years)

**Success Criteria** (Extraction Phase):
- [x] 16 key items identified and extracted (14 to 2022, plus 2 date corrections to 2021/2024)
- [x] Links verified: 6 YouTube links tested, 1 VMware link found broken, 7 items without links
- [x] Content types mapped to standard taxonomy (Presentations, Guest, Blog)
- [x] Duplicates detected (merge script: 76 → 54 unique for 2022)
- [x] Data merged into FINAL-2022.csv (54 videos, up from 39 - added 15 items)
- [x] other-content-2021.csv created (Mario vs. Steve blog)
- [x] other-content-2022.csv created (14 items: 11 presentations + 1 guest post + 1 blog + 1 keynote)
- [x] FINAL-ALL-HISTORICAL-2020-2024.csv regenerated (289 videos, up from 273)
- [x] Learnings documented
- [x] More items than expected (~4 estimated, actually added 14 to 2022)

**Note**: Google Sheets import deferred to Milestone 6.6 (after all extractions complete)

---

### Milestone 6.5: IBM Videos Extraction (PHASE A)

**Goal**: Extract 7 IBM videos from YouTube playlist

**Status**: ✅ COMPLETE (extracted in Milestone 6.1)

**Sources**:
- YouTube Playlist: https://www.youtube.com/playlist?list=PLBexUsYDijaz14Mot8_6rAbxkoF4iS6PZ (7 videos)

**Decision Record** (resolved 2025-10-25):
- ✅ **Extraction method**: yt-dlp (same as other playlists)
- ✅ **Content type**: "Video"
- ✅ **Show name**: "IBM Cloud" (renamed from "IBM Videos")
- ✅ **Distribution**: 2020 (4 videos), 2021 (3 videos)

**Success Criteria** (Complete):
- [x] 7 video metadata extracted (title, date, URL)
- [x] Content type determined: "Video"
- [x] Videos added to FINAL CSVs by year (2020: 4, 2021: 3)
- [x] Process documented (yt-dlp extraction pipeline)

**Note**: This milestone was completed as part of Milestone 6.1's YouTube extraction phase

---

### Milestone 6.6: Google Sheets Import (PHASE B)

**Goal**: Import ALL FINAL CSVs to Google Sheets yearly tabs in ONE comprehensive operation

**Status**: ✅ COMPLETE

**Prerequisites**:
- ✅ Milestone 6.1 complete (YouTube playlists extracted)
- ✅ Milestone 6.2 complete (2024_Events spreadsheet extracted and merged)
- ✅ Milestone 6.3 complete (2023 spreadsheet extracted and merged)
- ✅ Milestone 6.4 complete (2022 spreadsheet extracted and merged)
- ✅ Milestone 6.5 complete (IBM videos extracted)

**Approach** (Simplified to 2-tab architecture):
1. Create single historical tab in 2025_Content_Created spreadsheet: `2024 & earlier`
2. Import ALL FINAL CSVs consolidated into single tab
3. Update sync script (src/sync-content.js) to read multiple tabs:
   - Sheet1 (current/ongoing 2025+ content)
   - 2024 & earlier (historical content 2020-2024)
4. Configure cross-posting disabled for historical content
5. Fix validation to accept "Presentation" singular (normalize to "Presentations")
6. Fix off-by-one row alignment bug in multi-tab reading
7. Add rate limiting (1500ms delay) to prevent Google Sheets quota errors
8. Test sync locally before deploying
9. Visual approval from user on imported data

**Success Criteria**:
- [x] Historical tab created in 2025_Content_Created spreadsheet ("2024 & earlier")
- [x] ALL historical content imported (289 videos in "2024 & earlier" tab)
- [x] Sync script reads multiple tabs successfully (Sheet1 + "2024 & earlier")
- [x] Cross-posting disabled for historical content
- [x] Type validation fixed (accept "Presentation" singular, normalize to "Presentations")
- [x] Row alignment bug fixed (consistent tabRowIndex tracking for both tabs)
- [x] Rate limiting added (1500ms delay between URL writes)
- [x] Pagination added to delete script (handle all posts, not just first 100)
- [x] Clean slate sync performed (deleted 245 pre-2025 posts, cleared column H, re-synced)
- [x] Local sync test passes (~330 posts created with correct alignment)
- [x] User visual approval of tab structure (2-tab approach approved)
- [x] Historical content appears on Micro.blog categories
- [x] Process documented (work log entry added below)

**Content Counts** (consolidated in "2024 & earlier" tab):
- 2020 content: 4 videos (IBM Cloud)
- 2021 content: 8 videos (IBM Cloud + Tanzu Tuesdays + blog)
- 2022 content: 54 videos (Enlightning, Presentations, Tanzu Tuesdays + spreadsheet additions)
- 2023 content: 99 videos (multiple sources + spreadsheet additions)
- 2024 content: 124 videos (playlists + events spreadsheet + other content)
- **Total**: 289 historical videos (imported to single "2024 & earlier" tab)

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

**Overall Completion Criteria:**
1. ✅ All 5 milestones completed (2024_Work_Details, 2024_Events, 2023, 2022, IBM videos)
2. ✅ Historical tab created in 2025_Content_Created: `2024 & earlier` (simplified from 5 yearly tabs)
3. ✅ Selected historical content migrated to "2024 & earlier" tab (289 videos)
4. ✅ All historical content synced to Micro.blog with cross-posting disabled
5. ✅ Sync script updated to read multiple tabs (Sheet1 + "2024 & earlier")
6. ✅ Published posts appear in correct chronological order
7. ✅ Process documented for adding more historical content in future

**Completeness Verification (Critical):**
- ✅ **Every video from YouTube playlists represented in final spreadsheet:**
  - You Choose! playlist: All videos accounted for
  - ⚡️ Enlightning playlist: All videos accounted for
  - Presentations & Guest Appearances playlist: All videos accounted for
  - IBM Videos playlist: All 7 videos accounted for
- ✅ **Software Defined Interviews website verification:**
  - All episodes from ep 83+ represented in spreadsheet
- ✅ **Verification process documented** for future playlist/website checking

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

### 2025-10-25 (Milestone 6.1: YouTube Extraction Complete)
**Duration**: ~4-5 hours (based on conversation timestamps)
**Branch**: feature/prd-6-milestone-6.1-youtube-extraction
**Primary Focus**: YouTube playlist extraction and CSV generation

**Completed Work**:
- [x] **YouTube playlist extraction pipeline**: 6 playlists processed with yt-dlp
  - You Choose!: 45 videos
  - ⚡️Enlightning (primary + alternate): 77 + 69 videos (14 unique in alternate)
  - Presentations & Guest: 58 videos
  - IBM Cloud: 7 videos
  - Cloud Native Live: 34 videos
- [x] **Software Defined Interviews scraping**: Episodes 83-111 from website
  - 29 episodes extracted with ordinal date parsing
  - URLs point to softwaredefinedinterviews.com/{episode}
  - Episodes 83-90 (2024) included in historical data, 91-111 (2025) correctly excluded
- [x] **Deduplication and merging**: merge-all-playlists.js
  - Normalize by title+date
  - Automatic year filtering (2020-2024 only)
  - 220 unique historical videos generated
- [x] **NEEDS_REVIEW workflow**: 46 Presentations & Guest videos flagged for manual type classification
- [x] **Data outputs**: 6 FINAL CSVs created (2020, 2021, 2022, 2023, 2024, ALL)
  - FINAL-2020.csv: 4 videos (IBM Cloud)
  - FINAL-2021.csv: 3 videos (IBM Cloud)
  - FINAL-2022.csv: 33 videos (⚡️Enlightning, Presentations & Guest)
  - FINAL-2023.csv: 82 videos (multiple sources)
  - FINAL-2024.csv: 98 videos (includes 8 SDI episodes Oct-Dec 2024)
  - FINAL-ALL-HISTORICAL-2020-2024.csv: 220 videos total

**Scripts Created**:
1. `src/process-youtube-playlist.js` - Extract yt-dlp JSONL to CSV
2. `src/compare-playlists.js` - Find unique videos between playlists
3. `src/merge-all-playlists.js` - Deduplicate and merge by year
4. `src/verify-2025-data.js` - Verify Sheet1 completeness
5. `src/scrape-sdi.js` - Scrape SDI website for episodes 83-111
6. `src/create-review-tab.js` - Generate NEEDS_REVIEW tab

**Key Learnings**:
- **yt-dlp works without API**: Public playlists don't need YouTube API keys
- **Playlists more reliable than spreadsheets**: Complete, accurate metadata
- **Deduplication essential**: Found 14 duplicate videos across Enlightning playlists
- **Type validation critical**: NEEDS_REVIEW pattern prevents incorrect auto-sync
- **Year filtering automatic**: SDI 2025 episodes (91-111) correctly excluded from historical data
- **Show name formatting**: ⚡️Enlightning (no space), IBM Cloud (not IBM Videos)
- **URL accuracy matters**: SDI links must point to softwaredefinedinterviews.com, not YouTube

**Remaining Milestone 6.1 Work**:
- [ ] Import FINAL CSVs to create yearly tabs in Google Sheets
- [ ] Update sync script to read multiple tabs (Sheet1 + yearly tabs)
- [ ] Visual approval from user on imported data
- [ ] Document complete process for future reference
- [ ] Commit and push feature branch

**Next Session Priorities**:
1. Create tabs 2020, 2021, 2022, 2023, 2024 in 2025_Content_Created spreadsheet
2. Import respective FINAL CSVs to each tab
3. Test sync script with multiple tabs
4. Document Milestone 6.1 learnings before starting 6.2

### 2025-10-25 (Milestone 6.1: Data Cleanup & Completeness Verification)
**Duration**: ~3 hours
**Primary Focus**: Title cleanup, corrections import, completeness verification, manual additions

**Completed Work**:
- [x] **Enlightning title cleanup**: Removed prefix variations from all Enlightning videos
  - Patterns removed: `⚡️ Enlightning-`, `ϟ Enlightning:`, `⚡ Enlightning `, trailing `ϟ`
  - Updated process-youtube-playlist.js with regex cleanup
  - Regenerated enlightning.csv and enlightning-alt.csv
  - Example: "⚡️ Enlightning - Open Policy Containers" → "Open Policy Containers"
- [x] **NEEDS_REVIEW corrections imported**: Applied user's manual classifications
  - Loaded needs-review-corrected.csv with 62 manually corrected entries (exported from NEEDS_REVIEW spreadsheet tab)
  - Updated merge-all-playlists.js to apply corrections during merge
  - Result: 0 NEEDS_REVIEW entries remaining in FINAL CSVs
- [x] **Additional playlists integrated**:
  - Two Friends Talking Tanzu: 7 videos (July 2024)
  - VMware Tanzu YouTube: 3 individual videos (2023-2024)
- [x] **Manual content additions from missing videos analysis**:
  - 2 Enlightning videos added (Feb 2024): "Open Policy Containers", "Keeping Your Secrets Secure with SOPS"
  - 1 Cloud Native Live video (July 2024): "CNL: Unlocking K8s jobs and CronJobs with the spin command trigger"
  - 2 blog posts tracked separately (other-content-2024.csv): Syntasso guest post, VMware Tanzu blog
- [x] **Completeness verification**: Created verify-2024-completeness.js
  - Compared FINAL-2024.csv against 2024_Work_Details spreadsheet
  - Result: 98.2% complete (55/56 videos accounted for)
  - 10 "missing" videos are false positives (spreadsheet dates off by 1 day from YouTube)
  - 1 video genuinely inaccessible (KuberTENes CNCF video - private/deleted)
- [x] **Final data statistics updated**:
  - Total historical videos: 234 (up from 220)
  - FINAL-2024.csv: 111 videos (up from 98)
  - Distribution: 2020 (4), 2021 (3), 2022 (33), 2023 (83), 2024 (111)

**Scripts Created/Updated**:
1. `src/verify-2024-completeness.js` - Compare spreadsheet against FINAL CSV
2. `src/list-sheets.js` - List all tabs in a spreadsheet
3. `src/debug-2024-spreadsheet.js` - Debug spreadsheet structure
4. `data/other-content-2024.csv` - Track non-YouTube content (blog posts)
5. Updated `src/merge-all-playlists.js` - Added "Other Content" playlist, NEEDS_REVIEW corrections

**Key Learnings**:
- **Date discrepancies common**: Spreadsheet dates can be off by 1 day from YouTube upload dates
- **Title cleanup essential**: Enlightning prefix variations cluttered titles unnecessarily
- **Manual review valuable**: User-corrected NEEDS_REVIEW data significantly improved accuracy
- **Playlist gaps exist**: Some videos in spreadsheets not in playlists (removed or private)
- **Multiple content types**: Blog posts need separate tracking (can't use playlist extraction)
- **Completeness verification critical**: Automated comparison catches missing content

**Remaining Milestone 6.1 Work**:
- [ ] Create yearly tabs in 2025_Content_Created spreadsheet
- [ ] Import FINAL CSVs to respective tabs
- [ ] Update sync script for multi-tab reading
- [ ] Visual approval from user
- [ ] Commit all changes

**Next Session Priorities**:
1. Create tabs 2020, 2021, 2022, 2023, 2024 in 2025_Content_Created spreadsheet
2. Import FINAL CSVs to each tab (234 videos total)
3. Update sync script to read multiple tabs
4. Get user approval on imported data
5. Commit and push all Milestone 6.1 work

### 2025-10-25 (Milestone 6.2: 2024_Events Extraction Complete + Strategic PRD Restructure)
**Duration**: ~2-3 hours
**Branch**: feature/prd-6-milestone-6.1-youtube-extraction
**Primary Focus**: Extract-first strategy implementation, 2024_Events manual extraction, PRD restructuring

**Strategic Changes**:
- [x] **Decision 4 added**: Extract-First Strategy
  - All data extraction (Milestones 6.1-6.4) completed BEFORE Google Sheets import
  - Avoids multiple imports to same tabs, enables comprehensive deduplication
  - Single import → test → approve workflow (cleaner than multiple append cycles)
- [x] **Milestone structure restructured**: Two-phase approach documented
  - Phase A (Extraction): Milestones 6.1-6.4 extract to FINAL CSVs only
  - Phase B (Import): New Milestone 6.6 handles ONE comprehensive import
- [x] **All milestone statuses updated**: Goals, success criteria, and notes clarified
- [x] **Milestone 6.1 marked complete**: YouTube playlist extraction
- [x] **Milestone 6.5 marked complete**: IBM videos (included in 6.1)
- [x] **Milestone 6.6 added**: Google Sheets import phase

**Milestone 6.2 Completed Work**:
- [x] **12 items extracted from 2024_Events spreadsheet**:
  1. Open at Intel podcast (Guest, 2/1/2024)
  2. Platformers video (Guest, 2/21/2024)
  3. Come Cloud with Us panel (Guest, 3/1/2024)
  4. Syntasso blog post (Guest, 3/11/2024)
  5. Open Source Summit presentation (Presentations, 4/26/2024)
  6. Morgan Stanley SpringOne Tour (Presentations, 5/7/2024)
  7. Tech World Human Skills podcast (Guest, 5/8/2024)
  8. Twitter Space - CNCF Ambassador (Guest, 5/31/2024)
  9. KubeFM podcast (Guest, 6/13/2024)
  10. Sabre SpringOne Tour (Presentations, 6/17/2024)
  11. Decodify Podcast (Guest, 6/19/2024)
  12. KCD Italy presentation (Presentations, 6/20/2024)
- [x] **Manual extraction approach**: User manually selected items and provided metadata
- [x] **Content types mapped**: Guest, Presentations, Blog
- [x] **Data merged**: FINAL-2024.csv updated (122 videos, up from 111)
- [x] **FINAL CSVs regenerated**: 245 total historical videos
- [x] **Completeness metric clarified**: 2024_Work_Details changed from "98.2%" to "100% extracted (1 inaccessible)"

**Key Learnings**:
- **Manual extraction effective**: For selective spreadsheet content, manual review faster than building extraction scripts
- **User-provided metadata**: Type, show, date, link provided directly - no hyperlink parsing needed
- **No programmatic extraction needed**: 2024_Events doesn't require Google Sheets API script
- **Extract-first strategy validated**: Deferring import until all extractions complete prevents rework

**Data Statistics**:
- Total historical: 245 videos (up from 234)
- 2024 videos: 122 (up from 111)
- Distribution: 2020 (4), 2021 (3), 2022 (33), 2023 (83), 2024 (122)

**Commits**:
- 29a7de5: docs(prd-6): implement extract-first strategy and complete Milestone 6.2
- 13fb29c: docs(prd-6): clarify 2024_Work_Details completeness as 100%

**Next Session Priorities**:
1. Decide: Extract 2023/2022 spreadsheets OR skip to import phase (Milestone 6.6)
2. If extracting: Milestone 6.3 (2023 Content) or Milestone 6.4 (2022 Content)
3. If skipping: Proceed to Milestone 6.6 (Google Sheets import with 245 videos)

### 2025-10-25 (Milestone 6.3: 2023 Content Spreadsheet Extraction Complete)
**Duration**: ~2-3 hours
**Branch**: feature/prd-6-milestone-6.1-youtube-extraction
**Primary Focus**: Manual extraction from 2023 spreadsheet + Tanzu Tuesdays playlist

**Completed Work**:
- [x] **Tanzu Tuesdays playlist extraction**: 11 videos (4 from 2021, 7 from 2022)
  - Playlist: https://www.youtube.com/playlist?list=PLBexUsYDijaz4LVYXNAtqyymzBcexMrcq
  - Extracted using yt-dlp pipeline (same as other playlists)
  - Integrated into merge-all-playlists.js
  - Note: No 2023 content in this playlist
- [x] **Manual extraction from 2023 Content spreadsheet**: 20 items reviewed, 16 items added
  - User manually marked items with "ADD" prefix in spreadsheet
  - One-by-one review: user provided URLs, I scraped metadata
  - Used WebFetch for podcasts/blogs, yt-dlp for YouTube videos
  - Manual entry for conference presentations without recordings
- [x] **Items added to other-content-2023.csv** (14 items):
  1. CodeMash presentation (1/13/2023) - no link
  2. Kube Cuddle podcast (10/16/2023)
  3. Kubernetes Podcast - KubeCon EU (6/6/2023)
  4. Upbound Blog post (3/26/2023)
  5. GOTO promo video (11/8/2023)
  6. VMware CNCF Ambassadors blog (5/24/2023)
  7. Humans of Cloud Native article (11/6/2023)
  8. Productivity Alchemy podcast (6/29/2023)
  9. DevOps Days Amsterdam video (6/22/2023)
  10. DevOps Days Amsterdam presentation (6/21/2023) - no link
  11. Kubernetes Unpacked podcast (10/5/2023)
  12. VMware Explore Keynote (8/21/2023) - no link, marked as Keynote
  13. Open at Intel podcast (8/30/2023)
  14. O'Reilly webinar (9/6/2023) - user corrected type to Presentations
  15. Ecosystem Panel Discussion (11/7/2023) - no link
  16. Coffee + Software with Josh Long (12/15/2023)
- [x] **Items added to other-content-2024.csv** (1 item):
  - Intel Developer blog (2/13/2024) - turned out to be 2024 content
- [x] **Items skipped** (5 items):
  - Superhero Podcast - taken down
  - K8s Atlanta Meetup - user said to skip
  - SpringOne Tour Virtual - duplicate (already in data)
  - DevOps Paradox Whitney bio - duplicate (wrong date in spreadsheet)
  - Open At Intel At KubeCon - 2024 content, duplicate
- [x] **Content types mapped**: Guest, Presentations, Video, Blog, Podcast
- [x] **Deduplication**: Manual review + merge script caught 5 duplicates
- [x] **Data merged**:
  - FINAL-2023.csv: 99 videos (up from 84 - added 15 items including Tanzu Tuesdays)
  - FINAL-2024.csv: 123 videos (up from 122 - added 1 item)
  - FINAL-2021.csv & FINAL-2022.csv: Updated with Tanzu Tuesdays videos
- [x] **FINAL CSVs regenerated**: 273 total (272 videos + headers)

**Scripts Modified**:
1. `src/merge-all-playlists.js` - Added Tanzu Tuesdays to playlists list
2. `data/other-content-2023.csv` - Created with 14 manually-entered items
3. `data/other-content-2024.csv` - Added 1 Intel Developer blog
4. `data/tanzu-tuesdays.csv` and per-year CSVs - Created via playlist extraction

**Key Learnings**:
- **Manual extraction efficient for selective content**: User-provided items one-by-one faster than building automated extraction
- **Spreadsheet dates can be inaccurate**: Multiple items had wrong dates (e.g., DevOps Paradox off by 1.5 months)
- **Deduplication essential**: Merge script caught duplicates that user initially missed
- **Content type corrections important**: O'Reilly webinar initially misclassified as Guest, user corrected to Presentations
- **Conference presentations without links still valuable**: User wanted them tracked even without recordings
- **WebFetch effective for metadata**: Podcasts, blogs, and other web content scraped successfully

**Data Statistics**:
- Total historical: 273 (272 videos)
- 2023 videos: 99 (98 data rows, up from 84 - added 15 items)
- 2024 videos: 123 (122 data rows, up from 122 - added 1 item)
- Distribution: 2020 (3), 2021 (6), 2022 (39), 2023 (98), 2024 (122)

**Next Session Priorities**:
1. Decide: Extract 2022 spreadsheet (Milestone 6.4) OR proceed to import phase (Milestone 6.6)
2. If extracting: Milestone 6.4 - Extract ~4 key items from 2022 spreadsheet
3. If skipping: Proceed to Milestone 6.6 (Google Sheets import with 272 videos)

### 2025-10-25 (Milestone 6.4: 2022 Content Spreadsheet Extraction Complete)
**Duration**: ~2-3 hours
**Branch**: feature/prd-6-milestone-6.1-youtube-extraction
**Primary Focus**: Manual extraction from 2022 spreadsheet, link verification, date corrections

**Completed Work**:
- [x] **2022 spreadsheet fetched**: 94-row spreadsheet extracted using Google Sheets API via teller
  - User manually marked 13 items with "ADD" prefix for extraction
  - Reviewed presentations, conferences, blog posts from throughout 2022
- [x] **Manual extraction from 2022 Content spreadsheet**: 16 items processed
  - User manually selected items one-by-one
  - Provided URLs for link verification
  - Specified full titles when needed
- [x] **Items added to other-content-2022.csv** (14 items):
  1. O'Reilly Software Development Superstream (3/23/2022) - verified link
  2. SpringOne Tour Chicago (4/26/2022) - no link
  3. Devoxx UK - Live Diagramming (5/18/2022) - verified YouTube link
  4. Devoxx UK - Codezillas (5/18/2022) - verified YouTube link
  5. NDC Copenhagen - Codezillas (5/29/2022) - verified YouTube link
  6. WeAreDevelopers World Congress (6/14/2022) - no link
  7. SpringOne Tour NYC (6/28/2022) - no link
  8. SpringOne Tour Seattle (7/12/2022) - no link
  9. London Java Community meetup (8/3/2022) - verified YouTube link
  10. VMware Explore - Knative Overview (8/29/2022) - broken link (404), added without
  11. DeveloperWeek Cloud (9/7/2022) - no link
  12. Deserted Island DevOps (9/14/2022) - verified YouTube link
  13. VMware Inspirational Women blog post (10/20/2022) - verified link
  14. SpringOne Tour San Francisco (12/4/2022) - no link
- [x] **Date corrections discovered**:
  - Mario vs. Steve blog: spreadsheet listed 2022, actual date 11/5/2021 (added to other-content-2021.csv)
  - Knative Serving blog: spreadsheet listed 1/31/2022, actual date 2/9/2024 (added to other-content-2024.csv)
- [x] **Link verification**: All YouTube links tested with yt-dlp before adding
  - 6 YouTube links verified and working
  - 1 VMware link found broken (404) - added presentation without link
  - 7 presentations without links (SpringOne Tour conferences - not recorded)
- [x] **Content types mapped**: Presentations (11), Guest (1), Blog (2)
- [x] **Deduplication**: Merge script handled duplicates
  - 2022: 76 total → 54 unique videos
- [x] **Data merged**:
  - FINAL-2021.csv: 8 videos (up from 6 - added Mario vs. Steve blog + Tanzu Tuesdays)
  - FINAL-2022.csv: 54 videos (up from 39 - added 15 items)
  - FINAL-2024.csv: 124 videos (up from 123 - added Knative Serving blog)
- [x] **FINAL CSVs regenerated**: 289 total (up from 273)

**Scripts Created/Modified**:
1. `src/fetch-2022-spreadsheet.js` - Fetch 2022 spreadsheet via Google Sheets API using teller
2. `data/other-content-2021.csv` - Created with Mario vs. Steve blog post
3. `data/other-content-2022.csv` - Created with 14 manually-entered items
4. `data/temp-2022-raw.csv` - User-marked spreadsheet with "ADD" prefixes

**Key Learnings**:
- **Manual extraction remained most efficient**: User marking + one-by-one review faster than automated extraction
- **Spreadsheet dates frequently wrong**: Both blog posts had incorrect years in spreadsheet (2021→2022, 2024→2022)
- **Link verification essential**: VMware Explore link returned 404, needed to add without link
- **YouTube links reliable**: All 6 YouTube links verified successfully with yt-dlp
- **Conference presentations often unrecorded**: SpringOne Tour presentations systematically had no links
- **User corrections important**: Full title needed for DeveloperWeek Cloud ("Charting Your Course Through the Kubernetes Landscape")
- **Scope exceeded expectations**: Estimated ~4 items, actually added 14 to 2022
- **Teller workflow smooth**: Google Sheets API access via teller worked seamlessly

**Data Statistics**:
- Total historical: 289 videos (up from 273 - added 16 items)
- 2021 videos: 8 (up from 6 - added 2 items)
- 2022 videos: 54 (up from 39 - added 15 items)
- 2024 videos: 124 (up from 123 - added 1 item)
- Distribution: 2020 (4), 2021 (8), 2022 (54), 2023 (99), 2024 (124)

**Phase A Extraction Status**: ✅ **100% COMPLETE**
- ✅ Milestone 6.1: YouTube playlists (234 videos)
- ✅ Milestone 6.2: 2024 Events (12 items)
- ✅ Milestone 6.3: 2023 Content (16 items)
- ✅ Milestone 6.4: 2022 Content (16 items)
- ✅ Milestone 6.5: IBM videos (included in 6.1)

**Next Session Priorities**:
1. Proceed to Milestone 6.6: Google Sheets Import (Phase B)
2. Import all 289 videos to yearly tabs (2020, 2021, 2022, 2023, 2024)
3. Update sync script to read multiple tabs
4. Test and get user approval

### 2025-10-25 (Milestone 6.6: Google Sheets Import Complete)
**Duration**: ~4-5 hours (based on conversation timestamps)
**Branch**: feature/prd-6-milestone-6.1-youtube-extraction
**Primary Focus**: Multi-tab sync implementation, validation fixes, rate limiting, clean slate sync

**Completed Work**:
- [x] **Multi-tab reading implemented**: Sync script reads Sheet1 + "2024 & earlier" tabs
  - Evidence: src/sync-content.js:981-1013 (reads both tabs with metadata tracking)
  - Each row tracks `tabName` and `tabRowIndex` for correct URL writeback
  - Header detection works for both tabs (tabRowIndex === 1)
- [x] **Type normalization**: "Presentation" singular → "Presentations" plural
  - Evidence: src/sync-content.js:parseRow() function
  - All 29 "Presentation" rows now validate successfully
  - No more skipped presentations due to type mismatch
- [x] **Row alignment bug fixed**: Consistent tabRowIndex tracking for both tabs
  - Evidence: src/sync-content.js:999-1013 (both tabs include header rows)
  - Removed .slice(1) inconsistency that caused off-by-one errors
  - URLs now write to correct rows in both tabs
- [x] **Rate limiting added**: 1500ms delay between URL writes
  - Evidence: src/sync-content.js:1168 (await sleep(1500))
  - 40 writes/min = 67% of Google Sheets quota (60/min limit)
  - 33% buffer prevents quota errors during sync
- [x] **Pagination added to delete script**: Handle all posts, not just first 100
  - Evidence: src/delete-old-posts.js:15-60 (fetchAllPosts with offset/limit loop)
  - Successfully found 330 total posts on micro.blog
  - Deleted 245 pre-2025 posts (2020-2024 content)
- [x] **Clean slate sync**: Deleted all pre-2025 posts, cleared column H, re-synced
  - User manually cleared column H URLs from both tabs
  - Ran delete script to remove 245 historical posts from micro.blog
  - Final sync created ~330 posts with correct row alignment
  - Only 7 rows skipped (test data: Pizza, Credential, Coding Project types)

**Code Changes**:
- `src/sync-content.js:981-1013`: Multi-tab reading with metadata tracking
- `src/sync-content.js:parseRow()`: Type normalization (Presentation → Presentations)
- `src/sync-content.js:1168`: Rate limiting (1500ms delay)
- `src/sync-content.js:446-465`: Updated writeUrlToSpreadsheet to accept tabName parameter
- `src/delete-old-posts.js:15-60`: Pagination support (fetchAllPosts loop)
- `src/check-posts.js`: Created to check post counts by year
- `package.json:12`: Added delete-old-posts script

**Key Learnings**:
- **2-tab architecture simpler than 5-tab**: Consolidated "2024 & earlier" tab easier to maintain than separate yearly tabs
- **Type normalization prevents validation errors**: "Presentation" vs "Presentations" caused 29 rows to be skipped
- **Rate limiting essential**: 1500ms delay prevents Google Sheets quota errors (60 writes/min limit)
- **Pagination critical for deletions**: Delete script must handle all posts, not just first 100 returned by API
- **Off-by-one bugs subtle**: Consistent header row handling critical for correct URL alignment
- **Clean slate approach effective**: Delete all, clear column H, re-sync ensures correct state

**Architectural Divergence from PRD Plan**:
- **PRD Expected**: 5 yearly tabs (2020, 2021, 2022, 2023, 2024) + Sheet1
- **Actual Implementation**: 2 tabs (Sheet1 + "2024 & earlier")
- **Rationale**: Simpler to manage, same functionality, easier to maintain
- **User Approval**: ✅ 2-tab structure approved by user

**Bug Fixes**:
1. **Validation bug**: "Presentation" singular not recognized → normalized to "Presentations"
2. **Row alignment bug**: Off-by-one errors in "2024 & earlier" tab → fixed with consistent header handling
3. **Rate limiting bug**: No delay between writes caused quota errors → added 1500ms delay
4. **Pagination bug**: Delete script only found 100 posts → added offset/limit loop

**Data Statistics**:
- Total posts synced: ~330 (2025 content + 289 historical)
- Historical content: 289 videos (2020-2024)
- Pre-2025 posts deleted: 245
- Rows skipped: 7 (test data only)

**Next Steps**:
1. Monitor hourly sync runs for any issues
2. User can make spreadsheet changes, sync will pick them up automatically
3. Consider future improvements: orphan cleanup, URL update detection

### 2025-10-24 (Major Decisions & Structure Defined)
- **✅ Historical spreadsheet analysis completed**: All 4 spreadsheets analyzed (2022, 2023, 2024-1, 2024-2)
  - Format analysis script created: `src/analyze-historical-sheets.js`
  - Format differences documented (7-18 columns, different structures per year)
  - Hyperlinks confirmed in all sheets
- **✅ Architecture Decision**: Single spreadsheet with yearly tabs (Decision 2)
  - Target: 2025_Content_Created spreadsheet
  - Tabs: `Sheet1` (current), `2024`, `2023`, `2022` (historical)
  - No annual setup burden
- **✅ Phased Approach Decision**: One year at a time (Decision 3)
  - 5 separate milestones defined (6.1-6.5)
  - Each milestone completely self-contained
  - Specific decisions deferred to implementation time
- **✅ Content sources documented**:
  - All spreadsheet URLs captured
  - YouTube playlist URLs captured (You Choose!, ⚡️ Enlightning, SDI, Presentations, IBM)
  - Software Defined Interviews website noted (ep 83+)
- **✅ Completeness requirement added**: Verify all playlist/website content represented in final spreadsheet
- **Teller documentation**: Created `docs/development-setup.md` documenting teller command pattern (`$(which node)`)
- **Next Steps**:
  1. Start Milestone 6.1: 2024_Work_Details Integration
  2. Decide on data source approach (spreadsheets vs playlists vs hybrid)
  3. Build extraction and migration tooling

### 2025-10-19 (PRD Creation)
- **Issue Created**: [#6](https://github.com/wiggitywhitney/content-manager/issues/6)
- **PRD File Created**: `prds/6-historical-content-integration.md`
- **Status**: Planning phase - open questions identified

---

*This PRD will be updated as each milestone progresses.*

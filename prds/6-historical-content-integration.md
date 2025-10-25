# PRD: Historical Content Spreadsheet Integration

**Issue**: [#6](https://github.com/wiggitywhitney/content-manager/issues/6)
**Status**: Planning
**Priority**: Medium
**Created**: 2025-10-19
**Last Updated**: 2025-10-24

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

Each milestone is a **completely separate effort**. Complete one milestone fully (plan → implement → document learnings) before starting the next.

**Cross-posting**: All historical content imported with **cross-posting disabled** (consistent with PRD-6 original approach) to avoid spamming followers with old content.

---

### Milestone 6.1: 2024_Work_Details Integration

**Goal**: Migrate 2024 work/content details (primarily Enlightning streams) to `2024` tab

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

**Success Criteria**:
- [x] 2024 work/content data extracted from YouTube playlists (98 videos for 2024)
- [x] Additional years extracted: 2020 (4), 2021 (3), 2022 (33), 2023 (82)
- [x] Data normalized to compatible format (Name, Type, Date, Link columns)
- [x] NEEDS_REVIEW tab created for manual classification (46 Presentations & Guest videos)
- [x] Software Defined Interviews episodes 83-111 scraped with correct URLs (softwaredefinedinterviews.com/{episode})
- [x] Deduplication logic implemented (found 14 unique videos in Enlightning alternate playlist)
- [x] Year filtering implemented (2025 content automatically excluded)
- [x] FINAL CSVs generated (6 files: by year + combined)
- [x] **Completeness verification**: All videos from 2024_Work_Details spreadsheet verified - 98.2% complete (55/56 videos, 1 inaccessible)
- [ ] New tabs `2024`, `2023`, `2022`, `2021`, `2020` created in 2025_Content_Created spreadsheet
- [ ] Historical content rows imported to yearly tabs
- [ ] Sync script updated to read multiple tabs (Sheet1 + yearly tabs)
- [ ] Cross-posting disabled for historical import (requires sync script update)
- [ ] Visual approval from user on imported data
- [ ] Learnings documented for next milestone

---

### Milestone 6.2: 2024_Events Integration

**Goal**: Migrate 2024 events (conferences, webinars, podcasts) to `2024` tab

**Sources**:
- Primary: 2024_Events spreadsheet (61 rows, 18 columns)
- Supplementary: Presentations & Guest Appearances playlist (verification)

**Open Questions** (to be resolved during this milestone):
- Use "EXPORT INDICATOR" to filter rows?
- Which event types to include? (conferences, webinars, podcasts, vs internal events)
- How to extract URLs from hyperlinks in NAME and CONTENT LINK columns?
- Content type mapping strategy for various EVENT TYPEs
- Merge with 6.1 data in same `2024` tab or keep separate?

**Success Criteria**:
- 2024 events data extracted and filtered
- Hyperlinks extracted from NAME and CONTENT LINK columns
- Event types mapped to standard taxonomy (Podcast, Video, Presentations, Guest, Blog)
- Data merged into `2024` tab (or added if tab doesn't exist yet)
- Cross-posting disabled
- Learnings documented

---

### Milestone 6.3: 2023 Content Integration

**Goal**: Migrate 2023 content to `2023` tab

**Sources**:
- Primary: 2023 Content spreadsheet (63 rows, 14 columns)
- Note: May also include "2023_Work_Details + Enlightnings" sources (TBD during implementation)
- Supplementary: YouTube playlists for verification (Software Defined Interviews ep 83+, ⚡️ Enlightning)

**Open Questions** (to be resolved during this milestone):
- Clarify "2023_Work_Details + Enlightnings" - separate sources or within main sheet?
- Selective filtering approach (fewer rows = easier curation)?
- URL extraction from Event and Video columns
- Type mapping for "Type of content or engagement" values
- Use YouTube playlists to verify completeness?

**Success Criteria**:
- 2023 content sources identified and extracted
- Data normalized to compatible format
- New tab `2023` created in 2025_Content_Created spreadsheet
- Selected content migrated to `2023` tab
- Cross-posting disabled
- Learnings documented
- Apply lessons from Milestones 6.1 and 6.2

---

### Milestone 6.4: 2022 Content Integration

**Goal**: Migrate ~4 key items from 2022 to `2022` tab

**Sources**:
- Primary: 2022 Content spreadsheet (94 rows, 13 columns)
- Estimated inclusion: ~4 key items (highly selective)

**Open Questions** (to be resolved during this milestone):
- Which are the ~4 key items to include?
- Skip non-content rows (holidays, personal time, company events)?
- URL extraction from Event and Video columns
- Type mapping for 2022 "Type" values
- Content still accessible (VMware blog posts → Broadcom transition)?

**Success Criteria**:
- ~4 key items identified and extracted
- Data normalized to compatible format
- New tab `2022` created in 2025_Content_Created spreadsheet
- Selected content migrated to `2022` tab
- Cross-posting disabled
- Learnings documented
- Most selective milestone (fewest rows migrated)

---

### Milestone 6.5: IBM Videos Integration

**Goal**: Extract 7 IBM videos from YouTube playlist and integrate

**Sources**:
- YouTube Playlist: https://www.youtube.com/playlist?list=PLBexUsYDijaz14Mot8_6rAbxkoF4iS6PZ (7 videos)

**Open Questions** (to be resolved during this milestone):
- Extract to which year tab? (based on video publish dates)
- YouTube metadata extraction: titles, dates, URLs
- Content type: "Video" or "Guest"?
- Manual entry vs. YouTube API script?

**Success Criteria**:
- 7 video metadata extracted (title, date, URL)
- Content type determined
- Videos added to appropriate year tab (likely 2024 or 2022 based on dates)
- Cross-posting disabled
- Process documented (in case more playlists need extraction in future)

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
2. ✅ Historical tabs created in 2025_Content_Created: `2024`, `2023`, `2022`
3. ✅ Selected historical content migrated to appropriate year tabs
4. ✅ All historical content synced to Micro.blog with cross-posting disabled
5. ✅ Sync script updated to read multiple tabs (Sheet1 + yearly tabs)
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

# PRD: Automated Content Publishing from Google Sheets to Micro.blog

**Issue**: [#1](https://github.com/wiggitywhitney/content-manager/issues/1)
**Status**: In Progress
**Priority**: High
**Created**: 2025-09-26
**Last Updated**: 2025-10-18

## Problem Statement

Whitney currently maintains a Google Sheets spreadsheet to track all her content (podcasts, videos, blog posts, conference talks, and guest appearances). Each time she publishes new content, she manually posts links to her micro.blog site. This manual process is:

- Time-consuming and repetitive
- Error-prone (easy to forget to post or post to wrong location)
- Inconsistent in formatting
- Doesn't scale as content volume increases

## Solution Overview

Build an automated system that syncs Whitney's Google Sheets content tracking spreadsheet with her micro.blog website (whitneylee.com). The system will:

1. Monitor the Google Sheets for new/updated/deleted rows
2. Automatically post content to appropriate micro.blog pages
3. Maintain full synchronization (create, update, delete operations)
4. Manage page visibility based on activity levels
5. Handle errors gracefully with notifications

## User Experience

### Current Workflow
1. Whitney publishes content (podcast, video, etc.)
2. Whitney manually adds row to Google Sheets
3. Whitney manually creates post on micro.blog
4. Whitney manually categorizes post to appropriate page

### New Workflow
1. Whitney publishes content
2. Whitney adds row to Google Sheets
3. System automatically creates appropriately formatted post on correct micro.blog page
4. System maintains sync if Whitney edits or removes spreadsheet entries

## Technical Requirements

### Google Sheets Integration
- **Source**: [Whitney's Content Tracking Spreadsheet](https://docs.google.com/spreadsheets/d/1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs/edit?usp=sharing)
- **Columns**: Name, Type, Show, Date, Location, Confirmed, Link
- **Authentication**: Google Sheets API with service account
- **Frequency**: Hourly checks for changes

### Content Type Mapping (Original Requirement)
**⚠️ Deprecated**: This original requirement with multiple type variations was simplified during implementation. See **Decision 5: Standardize Spreadsheet Type Values** for rationale and **Updated Content Type Mapping** for current implementation.

| Spreadsheet Type | Micro.blog Page | URL |
|------------------|----------------|-----|
| SDI Podcast | Podcast | whitneylee.com/podcast |
| Video - Livestream, Video - Livestr You Choose! | Video | whitneylee.com/video |
| Blog Post - CNCF Blog | Blog | whitneylee.com/blog |
| Presentation | Present | whitneylee.com/present |
| Guest - Podcast, Podcast guest | Guest | whitneylee.com/guest |

### Micro.blog Integration
**API Reference**: [Micro.blog API Capabilities](../docs/microblog-api-capabilities.md)

- **API**: Micropub API for post management
- **Authentication**: App token from micro.blog account
- **Operations**: Create, update, delete posts
- **Content Organization**: Categories (not pages) - posts are assigned to categories which create URLs like `/categories/podcast/`

**Important Clarification**: This PRD originally used the term "pages" to describe content organization (e.g., "Podcast page", "Video page"). After API research, we determined that Micro.blog **categories** are the appropriate mechanism:
- **Categories** = Content organization tags that create automatic URLs and RSS feeds
- **Pages** = Static content like About/Contact (not what we need)
- See [Categories vs Pages](../docs/microblog-api-capabilities.md#key-architectural-concepts) for details

### Post Format
**⚠️ Updated**: This original format was revised during implementation. See **Decision 12: Post Content Format** for actual implementation.

**Original planned format** (deprecated):
```markdown
[Title as clickable link](url)
Date
```

**Actual implemented format** (see Decision 12):
```markdown
Show Name: [Title](url)
```

Example:
```markdown
Software Defined Interviews: [Learning to learn, with Sasha Czarkowski](https://www.softwaredefinedinterviews.com/91)
```

**Key differences from original plan**:
- Show name prefix for context (required for multi-show content like Videos)
- No date in post content (Micro.blog auto-displays date from `published` parameter)
- Colon separator for clean visual distinction

### Sync Behavior
- **New Rows**: Create new micro.blog post on appropriate page
- **Updated Rows**: Update existing micro.blog post (preserve original date if possible)
- **Deleted Rows**: Remove corresponding micro.blog post
- **Duplicate Prevention**: Track posted content to avoid duplicates

### Page Visibility Management
- **Auto-hide Rule**: If a page has no new content for 4+ months, automatically hide from navigation
- **Auto-show Rule**: If hidden page receives new content, automatically show in navigation
- **Manual Override**: System should support manual visibility controls

## Implementation Approach

### Technology Stack
- **Runtime**: GitHub Actions (scheduled workflow)
- **Language**: JavaScript/Node.js
- **Storage**: GitHub repository files for tracking state
- **APIs**: Google Sheets API, Micro.blog Micropub API
- **Credential Management**: GitHub Secrets (simple, built-in solution)

### Architecture
```
Google Sheets ↔ GitHub Actions Worker ↔ Micro.blog
                       ↓
                State Tracking Files
                       ↓
                Error Notifications
```

### Error Handling
- **Network Issues**: Retry with exponential backoff
- **API Errors**: Log details and continue with next item
- **Authentication Issues**: Send immediate notification
- **Notifications**:
  - Email to Whitney for any errors
  - GitHub issue creation for persistent failures
- **Recovery**: System continues on next scheduled run

## Success Criteria

### Functional Requirements
- [ ] System successfully reads Google Sheets data
- [ ] System creates appropriate micro.blog pages (Podcast, Video, Blog, Present, Guest)
- [ ] New spreadsheet rows generate correctly formatted micro.blog posts
- [ ] Post edits in spreadsheet update micro.blog posts
- [ ] Row deletions remove micro.blog posts
- [ ] Pages auto-hide after 4 months of inactivity
- [ ] Error notifications work correctly

### Non-Functional Requirements
- [ ] System runs reliably on hourly schedule
- [ ] Processing time < 5 minutes per run
- [ ] Zero data loss (all spreadsheet changes reflected)
- [ ] Secure handling of API credentials
- [ ] Comprehensive logging for troubleshooting

## Implementation Milestones

### Milestone 1: Google Sheets API Setup & Local Testing
**Estimated Time**: ~2 hours total (broken into 6 small steps)

**Working Approach**: Complete one sub-step at a time before moving to the next.

#### Step 1.1: Environment Setup ✅
**Estimated Time**: 5-10 minutes
**Related Decisions**: Decision 1 (JavaScript/Node.js implementation)

- [x] Install `googleapis` npm package
- [x] Install `dotenv` npm package
- [x] Create basic project structure (`src/` folder)
- [x] Create simple test script that prints "Hello from content-manager!"

**Success Criteria**: Can run `npm install` and `node src/test.js` successfully ✅

#### Step 1.2: "Hello World" with Google API ✅
**Estimated Time**: 10-15 minutes
**Related Decisions**: Decision 2 (Hybrid secret management), Decision 4 (Dedicated service account with minimal permissions)

- [x] Create service account in Google Cloud Console (existing GCP project)
- [x] Upload service account JSON to Google Secret Manager
- [x] Create `.teller.yml` configuration for local secret management
- [x] Share spreadsheet with service account email
- [x] Create script that authenticates with Google Sheets API
- [x] Print "Successfully authenticated!" to console

**Success Criteria**: Script runs without authentication errors ✅
**Run with**: `npm run auth-test`

**Implementation Note**: Used Teller + Secret Manager approach (Decision 2) rather than local file storage for security best practices.

#### Step 1.3: Read Raw Spreadsheet Data ✅
**Estimated Time**: 10-15 minutes
**Related Decisions**: Decision 4 (Service account access to spreadsheet)

- [x] Share spreadsheet with service account email (completed in Step 1.2)
- [x] Connect to Whitney's spreadsheet using googleapis
- [x] Read the first sheet (no parsing, just raw data)
- [x] Print raw data arrays to console

**Success Criteria**: Can see the actual spreadsheet data in terminal ✅

**Observations**:
- Successfully read 89 rows from spreadsheet
- Data includes header row, month headers, empty rows, and content rows
- Type values now standardized (Podcast, Video) from Decision 5
- Some text contains newlines (will handle in parsing)

**Implementation Note**: Created temporary `read-sheet.js` script, verified functionality, then cleaned up to avoid accumulating intermediate scripts. Steps 1.4-1.6 will use one comprehensive, evolving script instead.

#### Steps 1.4-1.6: Comprehensive Script Development
**Combined Estimated Time**: 50-60 minutes
**Implementation Approach**: Build one evolving script that progressively adds parsing, validation, and logging

**Rationale**: Rather than creating separate intermediate scripts for each step (which would need cleanup), Steps 1.4-1.6 will be implemented as a single, comprehensive script that evolves through each phase. This avoids accumulating throwaway code and creates the foundation script for the final sync system.

#### Step 1.4: Parse into Basic Objects ✅
**Estimated Time**: 15-20 minutes
**Related Decisions**: Decision 5 (Standardized Type values), Decision 6 (Flexible data validation)

- [x] Convert row arrays into objects with named fields (Name, Type, Show, Date, Location, Confirmed, Link)
- [x] Handle header row detection
- [x] Map to simplified Type values (Podcast, Video, Blog, Presentation, Guest)
- [x] Print structured objects instead of arrays

**Success Criteria**: Output shows `{ name: "...", type: "...", date: "..." }` format ✅

**Implementation**: Created `parseRow()` function (src/sync-content.js:14-33) that converts raw arrays into structured objects with named fields and proper header detection.

#### Step 1.5: Add Simple Validation ✅
**Estimated Time**: 15-20 minutes
**Related Decisions**: Decision 6 (Flexible data validation with month header handling)

- [x] Check for required fields (Name, Type, Date, Link)
- [x] Allow optional fields to be empty (Show, Location, Confirmed)
- [x] Skip month header rows (rows with only Name filled, other required fields empty)
- [x] Count valid vs invalid rows
- [x] Log validation results

**Success Criteria**: Script reports "Found X valid rows, skipped Y rows" ✅

**Implementation**: Created `validateContent()` function (src/sync-content.js:41-74) with required field validation, month header detection, and Type value validation against standard list. Added statistics tracking (src/sync-content.js:131-145) that categorizes skipped rows by reason.

#### Step 1.6: Add Pretty Logging ✅
**Estimated Time**: 10-15 minutes
**Related Decisions**: Decision 7 (Pretty formatted logging for development)

- [x] Format output with visual hierarchy and indentation
- [x] Add timestamps to logs (format: `[YYYY-MM-DD HH:MM:SS]`)
- [x] Add visual indicators (✓ for valid, ✗ for skipped)
- [x] Create summary statistics (total rows, valid by type, skipped count)

**Success Criteria**: Nice, readable output when script runs (see Decision 7 for example format) ✅

**Implementation**: Added `formatTimestamp()` and `log()` helper functions (src/sync-content.js:8-30) for timestamped logging. Enhanced output with visual hierarchy, indentation, and ✓/✗ indicators (src/sync-content.js:165-171, 180, 183). Created comprehensive summary with type breakdown showing distribution across 5 content types (src/sync-content.js:188-211).

**Test Results**: Script successfully processes 88 rows, identifies 61 valid content items (19 Podcast, 26 Video, 4 Blog, 6 Presentation, 6 Guest), gracefully skips 27 rows (9 month headers, 8 empty, 4 invalid type, 6 missing fields).

**Milestone 1 Complete**: ✅ Can run a local Node.js script (`npm run sync`) that reads, parses, validates, and logs all spreadsheet data with comprehensive pretty formatting

### Milestone 2: GitHub Actions Integration ✅
**Estimated Time**: ~1-2 hours
**Actual Time**: ~1 hour

- [x] Create `.github/workflows/sync-content.yml`
- [x] Configure GitHub Secrets for service account credentials
- [x] Set up scheduled workflow (hourly or on-demand for testing)
- [x] Verify workflow runs successfully and logs spreadsheet data

**Success Criteria**: GitHub Actions successfully runs on schedule and logs spreadsheet data ✅

**Milestone 2 Complete**: ✅ GitHub Actions workflow runs successfully on manual trigger, processes 61 valid content items, and logs identical output to local runs. Hourly schedule configured but commented out (deferred to Milestone 4 per design decision).

### Milestone 3: Error Handling & Logging ✅
**Estimated Time**: ~1 hour
**Actual Time**: ~45 minutes

- [x] Add proper error handling for API failures (network, auth, rate limits)
- [x] Implement structured logging with different log levels
- [x] Test failure scenarios (invalid credentials, network timeout, malformed data)
- [x] Document error recovery behavior

**Success Criteria**: Script handles errors gracefully with actionable error messages ✅

**Milestone 3 Complete**: ✅ All error handling, logging, retry logic, and documentation implemented

### Milestone 4: Micro.blog Integration ✅
**Estimated Time**: ~2-3 hours
**Actual Time**: ~2 hours
**API Reference**: [Micro.blog API Capabilities](../docs/microblog-api-capabilities.md)

**Important Architectural Note**: Micro.blog uses **categories** (not pages) for content organization. Categories automatically create URLs like `/categories/podcast/` with individual RSS feeds. This is the correct approach for our use case.

#### Step 4.1: Authentication Setup (~15-20 min) ✅
**API Reference**: [Authentication Methods](../docs/microblog-api-capabilities.md#authentication)

- [x] Generate app token from micro.blog account (Account → Edit Apps)
- [x] Add `MICROBLOG_APP_TOKEN` to GitHub Secrets
- [x] Test authentication with Micropub config query
- [x] Verify token has full account access

**API Details**:
- Endpoint: `GET https://micro.blog/micropub?q=config`
- Header: `Authorization: Bearer YOUR_TOKEN`
- Success: Returns JSON with channels and media endpoint

**Implementation**: App token stored in Google Secret Manager (secret: `microblog-content-manager`), accessed via Teller for consistency with existing credential management patterns.

#### Step 4.2: Category Strategy (~30 min) ✅
- [x] Create 5 categories via Micro.blog web UI: podcast, video, blog, presentation, guest
- [x] (Optional) Create navigation pages linking to each category - Deferred to Milestone 6
- [x] Document category URLs (e.g., `https://whitneylee.com/categories/podcast/`)
- [x] Test category assignment via API

**API Details**:
- List categories: `GET /micropub?q=category`
- Categories are created automatically when first post uses them
- Assign category: `category=podcast` parameter in POST request

**Implementation**: All 5 categories verified existing in Micro.blog. Test posts successfully created and verified at category URLs.

#### Step 4.3: Post Creation Logic (~45-60 min) ✅
**API Reference**: [Micropub Create Posts](../docs/microblog-api-capabilities.md#supported-operations)

- [x] Implement Micropub POST request (form-encoded format recommended)
- [x] Map spreadsheet types to categories (Podcast → "podcast", Video → "video", etc.)
- [x] Format post content per PRD: `[Title](URL)\nDate`
- [x] Handle API responses (201/202 status, Location header)
- [x] Add error handling for auth failures, rate limits

**API Details**:
- Endpoint: `POST https://micro.blog/micropub`
- Required params: `h=entry`, `content=...`, `category=...`
- Optional: `published=...` (ISO 8601 timestamp)
- Response: Location header contains new post URL (save for updates/deletes)

**Implementation**: Created test scripts using form-encoded POST format. Successfully parsed Location header from 201/202 responses.

#### Step 4.4: Testing (~20-30 min) ✅
- [x] Create test post in each category
- [x] Verify posts appear at category URLs
- [x] Verify post format matches requirements
- [x] Test draft posts with `post-status=draft` - Used `published` status for testing
- [x] Verify error handling with invalid token

**Success Criteria**: Can authenticate and create posts in all 5 categories with correct formatting ✅

**Milestone 4 Complete**: ✅ All authentication, posting, and testing verified. Test posts successfully deleted. Code cleaned up (test scripts removed, only production code remains).

### Milestone 5: Full CRUD Operations
**Estimated Time**: ~3-4 hours
**API Reference**: [Micro.blog API Capabilities](../docs/microblog-api-capabilities.md)

**Important Design Decision**: Using spreadsheet Column H ("Micro.blog URL") as sync state instead of separate state file. Spreadsheet is single source of truth - script ensures Micro.blog matches spreadsheet exactly.

#### Step 5.1: Spreadsheet Update Capability (~30-45 min) ✅
- [x] Grant service account Editor permission (temporarily for Column H writes)
- [x] Add Column H: "Micro.blog URL" to spreadsheet
- [x] Test writing URLs back to spreadsheet after post creation
- [x] Implement Google Sheets write operations in sync script
- [x] Handle write errors gracefully (don't fail sync if write fails)

**Spreadsheet Columns** (after this step):
| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Name | Type | Show | Date | Location | Confirmed | Link | Micro.blog URL |

**Implementation Notes**:
- Column H stores the Micro.blog post URL returned in Location header
- Empty Column H = post needs to be created
- Filled Column H = post exists (check for updates/deletes)

#### Step 5.2: New Row Detection & Post Creation (~45-60 min) ✅
- [x] Read spreadsheet including Column H
- [x] Identify rows with empty Column H (new content to post)
- [x] Create posts via Micropub with `published` date from Date column
- [x] Write returned post URLs back to Column H
- [x] Handle partial failures (some posts succeed, some fail)
- [x] Log creation statistics

**⚠️ IMPORTANT: Before bulk-creating posts** (especially when back-filling historical content or testing), **disable cross-posting in Micro.blog settings** to prevent spamming connected social accounts.

**Completed 2025-10-19**: Successfully created 61 posts from spreadsheet (cross-posting was disabled). Implementation includes:
- Date parsing to ISO 8601 (UTC noon) - handles MM/DD/YYYY and "Month Day, Year" formats
- Post content formatting with keynote support: `[Keynote] Show Name: [Title](url)`
- Category mapping: Podcast, Video, Blog, Presentations, Guest (title case)
- Support for presentations without URLs (plain text titles)
- Comprehensive error handling and statistics logging
- 100% success rate (61/61 posts created)

**API Details for Creation**:
- Parse Date column (e.g., "January 9, 2025") → ISO 8601 (`2025-01-09T00:00:00Z`)
- Include `published` parameter so posts appear in chronological order
- Save Location header response to Column H

**Example**:
```javascript
// Row: "Learning to learn" | Podcast | ... | "January 9, 2025" | ... | ""
// Creates post with published=2025-01-09T00:00:00Z
// Writes "https://whitneylee.com/2025/01/09/post-slug.html" to Column H
```

#### Step 5.3: Update Detection (~60-90 min) ✅
**API Reference**: [Micropub Update Operations](../docs/microblog-api-capabilities.md#supported-operations)
**Completed**: 2025-10-19

- [x] For rows with filled Column H, compare current data vs last sync
- [x] Detect changes in Name, Date, Link, Type (category), Show, or Confirmed (keynote) columns
- [x] Implement Micropub update operation with JSON format
- [x] Fix date comparison bug (normalize timezone formats)
- [x] Log update statistics

**Test Case for Step 5.3**:
- **AI Tools Lab video** (Row 48, created 2025-10-19): Spreadsheet Type changed from "Video" to "Guest" after post creation
- URL: `https://whitneylee.com/2025/05/22/ai-tools-lab-vibe-coding.html`
- Expected behavior: Update detection should identify Type change and update post category from "Video" to "Guest"
- This is an intentional test case - do not manually fix before implementing Step 5.3

**Change Detection Strategy**:
- **Option A**: Compare with in-memory snapshot from script start
- **Option B**: Store hash of row data in Column I (optional optimization)
- **Recommendation**: Start with Option A (simpler)

**API Details for Updates**:
```json
{
  "action": "update",
  "url": "https://whitneylee.com/2025/01/09/post-slug.html",
  "replace": {
    "content": ["[Updated Title](https://new-url.com)\nJanuary 10, 2025"],
    "published": ["2025-01-10T00:00:00Z"]
  }
}
```

#### Step 5.4: Delete Detection & Removal (~30-45 min) ✅
**API Reference**: [Micropub Delete Operations](../docs/microblog-api-capabilities.md#supported-operations)
**Completed**: 2025-10-19

- [x] Query all posts from 5 categories via Micropub (`q=source`)
- [x] Build list of all post URLs in Micro.blog
- [x] Compare with Column H URLs in spreadsheet
- [x] Delete posts that exist in Micro.blog but not in spreadsheet
- [x] Handle "already deleted" errors (404) gracefully
- [x] Log deletion statistics

**Deletion Logic**:
```
Micro.blog posts: [A, B, C, D]
Spreadsheet Column H: [A, B, C]
→ Delete post D (orphaned)
```

**API Details for Query**:
- Endpoint: `GET /micropub?q=source&limit=100`
- May need pagination for large numbers of posts
- Returns array of post objects with URLs

**API Details for Deletes**:
```json
{
  "action": "delete",
  "url": "https://whitneylee.com/2025/01/09/post-slug.html"
}
```

#### Step 5.5: Testing Full Sync (~30-45 min) ✅
**Completed**: 2025-10-19

- [x] Test create: Add new row with empty Column H, verify post created and URL written
- [x] Test update: Edit Name/Date/Link, verify post updated in Micro.blog
- [x] Test delete: Remove row from spreadsheet, verify post deleted from Micro.blog
- [x] Test idempotency: Run sync twice, verify no duplicate posts or unnecessary updates
- [x] Test partial failures: Observed network failures (503 errors) handled gracefully with retry logic

**Success Criteria**: Complete CRUD operations working - spreadsheet is single source of truth, Micro.blog automatically matches spreadsheet state ✅

**Bug Fixed During Testing**: Orphan detection was deleting newly created posts because it used cached spreadsheet data. Fixed by updating in-memory row data (line 915: `row.microblogUrl = postUrl`) immediately after URL write-back, preventing false orphan detection.

### Milestone 6: Page Visibility Management
**Estimated Time**: ~2-3 hours (or may be simplified based on API constraints)
**API Reference**: [XML-RPC Page Management](../docs/microblog-api-capabilities.md#xml-rpc-api)

**Important Note**: Original PRD assumed managing "page" visibility, but we're using **categories** for content organization. Category navigation is managed differently - see implementation options below.

#### Step 6.1: Activity Tracking (~30-45 min) ✅
- [x] Track last post date for each category in state file
- [x] Calculate days since last post for each category
- [x] Identify categories inactive for 4+ months
- [x] Log activity status for all categories

**State File Addition**:
```json
{
  "categories": {
    "podcast": { "lastPostDate": "2025-01-15", "daysSincePost": 3 },
    "video": { "lastPostDate": "2024-08-10", "daysSincePost": 160 }
  }
}
```

#### Step 6.2: Navigation Management via XML-RPC (~60-90 min)
**API Reference**: [XML-RPC Page Methods](../docs/microblog-api-capabilities.md#page-management-methods)
**Decision**: Option B selected (2025-10-24) - See Decision 19

**Implementation Note**: Navigation pages already exist in Micro.blog for all 5 categories (Video, Podcast, Guest, Blog, Presentations) with redirects configured to category URLs. We only need to query existing pages and toggle `is_navigation` parameter.

- [ ] Query existing pages via `microblog.getPages`
- [ ] Identify the 5 category navigation pages by title
- [ ] Extract page IDs for tracking
- [ ] Implement `microblog.editPage` to toggle `is_navigation` parameter
- [ ] Auto-hide pages when category inactive 4+ months
- [ ] Auto-show pages when category receives new content
- [ ] Store page ID mappings (category name → page ID)

**API Details for XML-RPC**:
- Endpoint: `https://micro.blog/xmlrpc`
- Method: `microblog.getPages` - List all pages with IDs and is_navigation status
- Method: `microblog.editPage` - Update page with new is_navigation value
- Parameters: `page_id`, `is_navigation` (boolean)
- Authentication: Username + app token as password

**Simplified Workflow**:
1. One-time setup: Query pages, map category names to page IDs
2. Hourly sync: Check category activity, toggle is_navigation as needed
3. No page creation required (pages already exist)

#### Step 6.3: Testing (~30-45 min)
- [x] Test XML-RPC authentication with existing app token
- [x] Verify page query returns all category pages with correct IDs
- [x] Test is_navigation toggle (hide/show a test page)
- [ ] Test inactive category detection accuracy
- [ ] Verify page ID persistence across sync runs
- [x] Document approach in Progress Log

**Success Criteria**: Activity tracking works and navigation management approach is documented/implemented (may not include auto-hide if API limitations make it impractical)

### Milestone 7: Error Notifications & Monitoring
- [ ] Comprehensive error catching and logging
- [ ] Email notification system for errors
- [ ] GitHub issue creation for persistent failures
- [ ] Retry logic with exponential backoff
- [ ] Health check and status reporting

**Success Criteria**: System handles errors gracefully and notifies appropriately

### Milestone 8: Production Deployment
- [ ] System running on scheduled GitHub Actions
- [ ] All APIs and credentials properly configured
- [ ] Documentation for maintenance and troubleshooting
- [ ] Manual override capabilities for edge cases
- [ ] Performance optimization and monitoring

**Success Criteria**: System running autonomously with minimal maintenance required

### Milestone 9: Content-Based URL Slugs ❌ Not Feasible
**Status**: Cancelled after research and testing (2025-10-23)
**Estimated Time**: 2 hours spent on research and testing
**Problem**: Posts currently get timestamp URLs (`/130000.html`) instead of content-based slugs (`/demo-an-automated.html`)
**Root Cause**: Script doesn't send `name` parameter, resulting in "untitled posts"

#### Research Findings (2025-10-23)

**Test Results**:
- [x] ✅ Disabled cross-posting in Micro.blog settings
- [x] ✅ Tested `name` parameter behavior
- [x] ✅ Tested `mp-slug` parameter behavior
- [x] ✅ Documented Micro.blog URL generation quirks
- [x] ✅ Verified impact on post display format

**Key Discovery**: Adding `name` parameter creates "titled posts" instead of "untitled posts"

**Titled Posts (with `name` parameter)**:
- Post displays as title with "Continue reading →" link
- Requires extra click to see content
- Poor user experience for content link aggregation
- Does generate content-based URLs

**Untitled Posts (without `name` parameter)**:
- Content displays directly on category pages
- Single click to reach linked content
- Better UX for link sharing use case
- Generates timestamp URLs (`/130000.html`)

**Decision**: Keep existing untitled post format
- **Rationale**: Direct content display more important than SEO-friendly URLs for this use case
- **Trade-off**: Accept timestamp URLs to maintain good UX
- **Impact**: All posts remain untitled for consistent, streamlined display

#### Implementation Notes

**Tested but Rejected**:
- `mp-slug` parameter: Micro.blog does not respect custom slug suggestions despite IndieWeb documentation listing it as supported
- Show name in title: Successfully generates unique slugs but creates unwanted titled format
- Title + show combinations: Creates very long titles and still has click-through issue

**Code Changes Made and Reverted**:
- Added `generatePostTitle()` helper - REMOVED
- Added `name` parameter to `createMicroblogPost()` - REMOVED
- Added name change detection to `detectChanges()` - REMOVED
- Test scripts for slug validation - REMOVED

**Final State**: Code returned to Milestone 5 implementation (untitled posts with timestamp URLs)

## Dependencies & Risks

### External Dependencies
- **Google Sheets API**: Changes to API could break integration
- **Micro.blog API**: API limitations or changes affect functionality
- **GitHub Actions**: Service availability and execution limits
- **Network Connectivity**: Required for all API communications

### Technical Risks
- **API Rate Limits**: Both Google and Micro.blog have usage restrictions
- **Authentication Expiry**: Service account keys and tokens may need renewal
- **Data Format Changes**: Spreadsheet column changes could break parsing
- **Micro.blog Limitations**: Unknown constraints on page management or post editing

### Mitigation Strategies
- **API Limits**: Implement respectful rate limiting and caching
- **Auth Management**: Set up monitoring and renewal alerts
- **Schema Flexibility**: Build robust parsing that handles minor changes
- **Micro.blog Research**: Test API capabilities thoroughly during development

## Definition of Done

The feature is complete when:
1. Whitney can add a row to her Google Sheets and see it automatically posted to the correct micro.blog page within 1 hour
2. She can edit spreadsheet entries and see updates reflected on micro.blog
3. She can delete spreadsheet rows and see posts removed from micro.blog
4. Pages automatically hide after 4 months of no activity
5. She receives email notifications for any system errors
6. The system runs reliably without manual intervention

## Design Decisions

### Decision 1: Use JavaScript/Node.js for Implementation
**Date**: 2025-10-04
**Rationale**:
- Repository already has Node.js infrastructure (package.json, node_modules)
- Excellent Google Sheets API support via `googleapis` npm package
- Consistency with existing tooling (commit-story MCP server already uses Node.js)
- Strong GitHub Actions support for Node.js workflows

**Impact**:
- Milestone 1 tasks will use Node.js and npm ecosystem
- Can leverage existing Node.js knowledge and patterns
- Faster setup time since infrastructure already exists

### Decision 2: Hybrid Secret Management Strategy (Local + CI)
**Date**: 2025-10-04 (Updated: 2025-10-17)
**Rationale**:
- Whitney already uses Teller + Google Secret Manager for other projects
  - Example config: `platform-vibez/.teller.yml`
  - Using existing GCP project for consistency
- Local development benefits from consistent secret management patterns
- GitHub Actions CI benefits from simpler, built-in GitHub Secrets
- Best of both worlds: use the right tool for each environment

**Implementation**:
- **Local Development**: Use Teller + Google Secret Manager (consistent with existing patterns)
- **GitHub Actions CI**: Use GitHub Secrets (simpler for automated workflows)
- Service account credentials stored in both locations
- Create `.teller.yml` in this repo (similar to platform-vibez pattern)

**Impact**:
- Milestone 1 will set up both Teller config and service account credentials
- Milestone 2 will configure GitHub Secrets for CI
- Developers use familiar Teller workflow locally: `teller run node src/sync-content.js`
- CI remains simple with GitHub Secrets

**When to Reconsider**: If secret management becomes more complex or requires centralized rotation/auditing across multiple systems.

### Decision 3: Break Foundation Setup Into Separate Milestones
**Date**: 2025-10-04 (Updated: 2025-10-17)
**Rationale**:
- Original "Foundation Setup" milestone was too large (4-6 hours) as a single atomic unit
- Breaking into 3 separate milestones provides meaningful, independently testable chunks:
  - Milestone 1: Core functionality working locally
  - Milestone 2: CI/CD integration
  - Milestone 3: Production-ready error handling

**Impact**:
- Better progress tracking with clear milestone boundaries
- Each milestone delivers concrete, testable value
- Easier to pause/resume work between milestones
- Clearer success criteria for each stage
- Total milestone count increased from 6 to 8

### Decision 4: Create Dedicated Service Account with Minimal Permissions
**Date**: 2025-10-17
**Rationale**:
- Existing default service accounts have excessive permissions (Editor role)
- Principle of least privilege requires scoping access to only Google Sheets API read
- Dedicated service account provides clear naming and purpose
- Easier to audit, manage, and revoke if needed

**Implementation**:
- Create new service account in existing GCP project
- Name with descriptive prefix (e.g., `content-manager-sheets@...`)
- Grant only: Google Sheets API read access
- Share spreadsheet (https://docs.google.com/spreadsheets/d/1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs/edit) with service account email
- Download JSON key for use in Teller and GitHub Secrets

**Impact**:
- Enhanced security posture with minimal permissions
- Clear ownership and purpose of service account
- Easier to track API usage and audit access
- No risk of accidental changes to other GCP resources

### Decision 5: Standardize Spreadsheet Type Values with Dropdown
**Date**: 2025-10-17
**Status**: ✅ Implementation Complete (2025-10-17)

**Rationale**:
- Current spreadsheet has inconsistent Type values: "SDI Podcast", "Video - Livestream You Choose!", "Blog Post - CNCF Blog", "Guest - Podcast", etc.
- Original PRD specified multiple variations per category, leading to complex parsing logic
- Simpler to standardize data at source (spreadsheet) than write flexible code
- Dropdown prevents future typos and ensures data consistency

**Implementation**:
- Spreadsheet location: https://docs.google.com/spreadsheets/d/1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs/edit
- Add data validation dropdown to Type column (Column B) with exactly 5 values:
  - `Podcast`
  - `Video`
  - `Blog`
  - `Presentation`
  - `Guest`
- Update existing rows to use standardized values
- Set dropdown to "Reject input" to prevent invalid entries

**Implementation Summary**:
- Created automated script to standardize existing Type values
- Updated 55 cells with standardized values (Podcast, Video, Blog, Presentation, Guest)
- Added dropdown validation to Type column
- Skipped 7 unmapped values (Pizza, Credential, Coding Project, Teaching Assistant) for manual handling
- Followed security best practices: temporarily granted Editor permission, reverted to Viewer after completion

**Impact**:
- Simpler parsing code with exact string matching
- No need for complex pattern matching or variations
- Reduced risk of mapping errors
- Clearer user experience when adding content
- **Updates Content Type Mapping** (see table below)

**Updated Content Type Mapping**:
| Spreadsheet Type | Micro.blog Category | Category URL |
|------------------|---------------------|--------------|
| Podcast | podcast | whitneylee.com/categories/podcast/ |
| Video | video | whitneylee.com/categories/video/ |
| Blog | blog | whitneylee.com/categories/blog/ |
| Presentation | presentation | whitneylee.com/categories/presentation/ |
| Guest | guest | whitneylee.com/categories/guest/ |

**Note**: Categories (not pages) are used per [API research findings](../docs/microblog-api-capabilities.md#categories)

### Decision 6: Flexible Data Validation with Month Header Handling
**Date**: 2025-10-17
**Rationale**:
- Spreadsheet contains month header rows ("January", "February", etc.) for organization
- These headers are useful for Whitney but need to be ignored by the system
- Month headers naturally fail validation (missing Type, Date, Link)
- Better to handle gracefully than require spreadsheet restructuring

**Implementation**:
- **Required fields** for valid content row:
  - Name (Column A)
  - Type (Column B)
  - Date (Column D) - flexible date parsing (handles both `1/9/2025` and `01/09/2025`)
  - Link (Column G) - must be valid URL
- **Optional fields** (can be empty):
  - Show (Column C)
  - Location (Column E)
  - Confirmed (Column F) - currently unused, will be ignored
- **Month header detection**: Rows with only Name filled and other required fields empty → skip silently
- **Invalid rows**: Log warning, skip row, continue processing other rows

**Impact**:
- No need to modify spreadsheet structure
- Graceful handling of organizational elements
- Clear logging distinguishes between month headers and invalid data
- System is resilient to data quality issues

### Decision 7: Pretty Formatted Logging for Development, JSON for Production
**Date**: 2025-10-17
**Rationale**:
- Milestone 1 is local development where human-readable logs are valuable
- Pretty formatted logs provide visual hierarchy and easy debugging
- JSON logs better suited for automated systems and log aggregation
- Different environments have different logging needs

**Implementation**:
- **Milestone 1 (local dev)**: Pretty formatted logs with timestamps, indentation, and visual indicators (✓/✗)
  ```
  [2025-10-17 14:30:17] INFO: Processing row 1/42
    Title: Learning to learn, with Sasha Czarkowski
    Type:  Podcast → /podcast
    Date:  January 9, 2025
    Link:  https://www.softwaredefinedinterviews.com/91
    ✓ Valid
  ```
- **Milestone 2+ (GitHub Actions)**: Structured JSON logs for machine parsing
  ```json
  {"timestamp":"2025-10-17T14:30:17Z","level":"info","row":1,"title":"Learning to learn","type":"Podcast","valid":true}
  ```

**Impact**:
- Better developer experience during local testing
- Production-ready logging for CI/CD monitoring
- Easy to grep/filter logs in automated environments
- Clear separation of concerns by environment

### Decision 8: GitHub Actions First, Azure Migration Later
**Date**: 2025-10-17
**Rationale**:
- Whitney is Microsoft MVP with free Azure credits
- Learning Azure is valuable for MVP activities
- However, GitHub Actions provides faster path to working system
- Core Node.js code will be identical regardless of deployment platform
- Better to get system working first, then migrate as learning exercise

**Implementation**:
- **Phase 1 (Milestones 1-8)**: Build and deploy on GitHub Actions as planned
- **Phase 2 (Future)**: Migrate to Azure Functions as learning opportunity
  - Azure Function with timer trigger (hourly)
  - Azure Key Vault for secret management
  - Same Node.js codebase, different deployment
  - Document learning experience for MVP activities

**Impact**:
- Faster time to working system (original PRD plan)
- Future migration path documented and planned
- Opportunity to learn Azure with real, working project
- Azure MVP credits available when ready to migrate
- No changes to Milestones 1-8

### Decision 9: Spreadsheet-Based State Tracking
**Date**: 2025-10-18
**Status**: ✅ Planned for Milestone 5

**Rationale**:
- Separate state file adds complexity (two sources of truth)
- Spreadsheet already contains all content data
- Adding Column H ("Micro.blog URL") makes sync status visible
- Single source of truth is simpler and less error-prone
- Easy to manually fix sync issues (edit/clear URL column)

**Implementation**:
- Add Column H: "Micro.blog URL" to spreadsheet
- Grant service account Editor permission (write URLs back)
- Script writes post URL to Column H after successful creation
- Empty Column H = post needs to be created
- Filled Column H = post exists (check for updates)

**Impact**:
- No separate state file to manage or commit
- Sync status visible directly in spreadsheet
- Natural audit trail of what's been posted
- Easy manual intervention if needed
- Requires WRITE access to Google Sheets (minor permission increase)

**When to Reconsider**: If spreadsheet writes become unreliable or if we need offline sync capability.

### Decision 10: Auto-Delete Orphaned Posts
**Date**: 2025-10-18
**Status**: ✅ Planned for Milestone 5

**Rationale**:
- Spreadsheet is single source of truth - should drive Micro.blog state completely
- Deleting spreadsheet row should delete corresponding post
- Manual cleanup is error-prone and defeats automation purpose
- Query-and-compare is straightforward with Micropub API

**Implementation**:
- Query all posts from 5 categories via `GET /micropub?q=source`
- Compare Micro.blog post URLs with Column H URLs in spreadsheet
- Delete posts that exist in Micro.blog but not in spreadsheet
- Handle 404 errors gracefully (already deleted)
- Log deletion statistics

**Impact**:
- True bidirectional sync: spreadsheet change = Micro.blog change
- Removes stale posts automatically
- One extra API call per sync run (query all posts)
- Slightly riskier (accidental spreadsheet deletion = post deletion)

**Safety Considerations**:
- Could add "Deleted" column instead of physically deleting rows
- Could add confirmation prompt for deletions
- Could log deletions prominently for audit trail

### Decision 11: Chronological Ordering via Published Date Parameter
**Date**: 2025-10-18
**Status**: ✅ Confirmed from API docs

**Rationale**:
- Need posts to appear in chronological order by actual publication date
- Creating posts in random order would mess up timeline
- Micro.blog supports `published` parameter per Micropub spec
- Allows backfilling old content without timeline disruption

**Implementation**:
- Parse Date column (e.g., "January 9, 2025") to ISO 8601 format (`2025-01-09T00:00:00Z`)
- Include `published` parameter in all post creation requests
- Posts will appear chronologically regardless of creation order
- Can sync entire spreadsheet in any order

**Confirmed from Documentation**:
- Micropub API docs (docs/microblog-api-capabilities.md:92)
- Parameter: `published` | Purpose: Publication timestamp | Format: ISO 8601

**Impact**:
- Can sync spreadsheet in any order (row order doesn't matter)
- Can backfill historical content without timeline issues
- Posts appear correctly ordered on Micro.blog site
- Simplifies implementation (no need to sort by date first)

### Decision 12: Post Content Format with Show Name Prefix
**Date**: 2025-10-19
**Status**: ✅ Tested and validated

**Rationale**:
- Original format (`[Title](url)\nDate`) had issues:
  - Date displayed twice (Micro.blog auto-shows date, plus our content date)
  - No show context for content types with multiple shows (Videos, Guest appearances)
  - Redundant and noisy UX
- Videos appear on different shows - need per-post show identification
- Podcasts are all "Software Defined Interviews" - can hardcode
- User feedback: "very noisy website" with duplicate dates

**Format Testing Process** (2025-10-19):
- ❌ Attempt 1: `Show Name\n[Title](url)` - Rendered as single line "Show Name Title"
- ❌ Attempt 2: `Show Name\n\n[Title](url)` - Created unwanted blank line gap
- ❌ Attempt 3: `Show Name  \n[Title](url)` - Markdown soft break didn't work
- ✅ **Final format**: `Show Name: [Title](url)` - Clean, clear visual separation

**Implementation Details**:
```javascript
// Post content format
const content = showName
  ? `${showName}: [${title}](${url})`  // With show name prefix
  : `[${title}](${url})`;               // Without (fallback)

// Show name logic by content type:
// - Podcast: Hardcode "Software Defined Interviews"
// - Video/Blog/Presentation/Guest: Use Column C (Show) from spreadsheet
// - If Column C empty: No show prefix (just linked title)
```

**Date Handling**:
- **DO NOT include date in post content** - Micro.blog automatically displays date from `published` parameter
- Parse spreadsheet Date column (Column D) to ISO 8601 for `published` parameter
- Use UTC noon (`12:00:00Z`) to avoid timezone shifts
- Manual MM/DD/YYYY parsing to prevent local timezone interpretation

**Example Posts**:
```markdown
Software Defined Interviews: [Learning to learn, with Sasha Czarkowski](https://www.softwaredefinedinterviews.com/91)

Conf42 DevOps 2025: [Kubernetes is a Social Construct](https://www.youtube.com/watch?v=xyz)

[Standalone blog post title](https://example.com/blog-post)
```

**Visual Result**:
- Category pages show: Date (auto), Show Name: Linked Title
- Clean, scannable list format
- Show context visible without extra clicks
- No duplicate/redundant information

**Impact**:
- Reduced noise - single date display instead of double
- Show context for multi-show content types (Videos especially)
- Consistent format across all content types
- Better user experience verified via live testing

**When to Reconsider**:
- If user wants show names on separate line (requires Micro.blog theme customization)
- If date needs to be in post content for some reason (would need to suppress Micro.blog auto-date)

### Decision 13: Category Naming - Plural and Title Case
**Date**: 2025-10-19
**Status**: ✅ Implemented

**Rationale**:
- Micro.blog UI uses title case categories: "Podcast", "Video", "Blog", "Guest"
- User configured "Presentations" (plural) in Micro.blog settings
- Initial implementation used "presentation" (lowercase, singular)
- Caused category mismatch - posts went to wrong category
- Standardizing on title case and plural for consistency with UI

**Implementation**:
```javascript
const categoryMap = {
  'Podcast': 'Podcast',
  'Video': 'Video',
  'Blog': 'Blog',
  'Presentation': 'Presentations',  // Note: plural
  'Guest': 'Guest'
};
```

**Impact**:
- Updated spreadsheet Type dropdown from "Presentation" to "Presentations"
- Updated 9 spreadsheet rows to use "Presentations"
- Migrated 3 existing posts from "presentation" to "Presentations" category
- All categories now match Micro.blog UI exactly

**When to Reconsider**:
- If Micro.blog changes category naming conventions
- If additional categories need different singular/plural handling

### Decision 14: Allow Presentations Without URLs
**Date**: 2025-10-19
**Status**: ✅ Implemented

**Rationale**:
- Some presentations don't have recordings yet (talks scheduled but not delivered, or not recorded)
- User wants to track all presentations in one place, even without video links
- Micro.blog supports posts with plain text (no hyperlink required)
- Better UX: complete list with "coming soon" placeholders than missing entries

**Implementation**:
- Removed Link (Column G) validation requirement for Presentations type only
- Post format when no URL: `Show Name: Title` (plain text, no hyperlink)
- Post format with URL: `Show Name: [Title](url)` (hyperlinked as normal)
- Spreadsheet validation still requires Link for all other content types

**Example Posts**:
```markdown
# With link
[Keynote] KCD Costa Rica: [Choose Your Own Adventure](https://youtu.be/xyz)

# Without link (plain text)
University Talk: Cloud computing presentation to university students
```

**Impact**:
- 2 presentations posted without URLs (rows 44, 84)
- All 9 presentations visible at /presentations/ including linkless ones
- Users can see complete presentation history even for unrecorded talks

**When to Reconsider**:
- If user prefers to omit unrecorded presentations from public list
- If other content types also need linkless support

### Decision 15: UTC Noon for Date Parsing
**Date**: 2025-10-19
**Status**: ✅ Implemented (revised from Decision 12)

**Rationale**:
- Spreadsheet dates are in MM/DD/YYYY format (e.g., "1/9/2025")
- JavaScript Date parsing interprets as local timezone, causing off-by-one errors
- Example: "1/9/2025" → `2025-01-08T08:00:00Z` (PST) → displays as Jan 8
- UTC noon (`12:00:00Z`) is safe middle ground - won't shift into previous/next day regardless of timezone
- Avoids need for explicit timezone configuration or guessing user's timezone

**Implementation**:
```javascript
function parseDateToISO(dateString) {
  const [month, day, year] = dateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`;
}
```

**Impact**:
- All 61 posts created with correct dates matching spreadsheet
- No timezone-related date shifts
- Consistent behavior regardless of server or user timezone
- Manual parsing avoids JavaScript's local timezone interpretation

**When to Reconsider**:
- If user wants posts to show specific timezone timestamps (not just dates)
- If Micro.blog adds date-only parameter (no timestamp required)

### Decision 16: Use mp-slug for Content-Based URLs and Slug Persistence
**Date**: 2025-10-22
**Status**: ✅ Planned for Milestone 9

**Rationale**:
- Current posts use timestamp URLs (`/130000.html`) due to missing `name` parameter
- Content-based URLs improve SEO and user experience
- Duplicate talk titles (same talk at different conferences) need unique URLs
- Post updates must preserve URLs even when titles change
- Micro.blog supports `mp-slug` Micropub extension for custom URL slugs

**Research Findings**:
- **`name` parameter**: Sets post title, Micro.blog auto-generates slug from it
- **`mp-slug` parameter**: Micropub extension for suggesting custom slugs
- **Micro.blog support**: Confirmed via IndieWeb documentation as supporting client
- **Server behavior**: May accept or modify suggested slug to avoid URL conflicts
- **Collision handling**: Server appends `-2`, `-3` etc. if slug already exists

**Implementation Strategy**:

**For Initial Post Creation**:
```javascript
// Generate unique slug from title + show name
const slug = slugify(`${title}-${show}`);
// Example: "Kubernetes is a Social Construct" + "DevOpsDays Rockies"
// → "kubernetes-social-construct-devopsdays-rockies"

// Send both name and mp-slug parameters
name: "Kubernetes is a Social Construct"
mp-slug: "kubernetes-social-construct-devopsdays-rockies"
```

**For Post Updates** (preserving URLs):
```javascript
// Extract existing slug from Column H URL
const existingUrl = row.microblogUrl; // From Column H
// "https://whitneylee.com/2025/01/09/kubernetes-social-construct-devopsdays-rockies.html"
const slug = extractSlugFromUrl(existingUrl);
// → "kubernetes-social-construct-devopsdays-rockies"

// Reuse SAME slug even if title changes
name: "Updated Title Here"  // Can change
mp-slug: "kubernetes-social-construct-devopsdays-rockies"  // Must stay same
```

**Slug Persistence**:
- No need for separate slug storage column
- Column H (Micro.blog URL) is source of truth
- Extract slug from URL path for updates
- Guarantees URL stability across content changes

**Duplicate Title Handling**:
```javascript
// Same talk, different conferences
Post 1: mp-slug: "kubernetes-social-construct-devopsdays-rockies"
Post 2: mp-slug: "kubernetes-social-construct-conf42-devops"
// Result: Unique URLs despite identical titles
```

**Impact**:
- Better SEO with keyword-rich URLs
- Professional link sharing on social media
- Stable URLs even when content is updated
- Clear conference context in URLs for duplicate talks
- No manual intervention needed for URL management

**Code Changes Required**:
- Add `slugify()` helper function (lowercase, hyphenate, remove special chars)
- Add `extractSlugFromUrl()` helper function for updates
- Update `createMicroblogPost()` to include `mp-slug` parameter
- Update `updateMicroblogPost()` to extract and reuse existing slug
- Add slug generation logic based on Column A + Column C

**Testing Plan** (Milestone 9, Step 9.1):
- Test `name` parameter alone (observe auto-generated slug)
- Test `mp-slug` parameter (verify server respects suggestion)
- Test duplicate titles with different slugs (confirm uniqueness)
- Test post update with same slug (verify URL preservation)
- Document any Micro.blog quirks in slug handling

**When to Reconsider**:
- If Micro.blog changes `mp-slug` support in future updates
- If URL conflicts become frequent (may need more sophisticated slug generation)
- If user wants shorter slugs (currently includes both title and show name)

**References**:
- [Micropub Extensions - mp-slug](https://indieweb.org/Micropub-extensions#Slug)
- [Micro.blog API Capabilities - URL Slug Generation](../docs/microblog-api-capabilities.md#url-slug-generation)

### Decision 17: Reject Content-Based URL Slugs (Milestone 9 Cancelled)
**Date**: 2025-10-23
**Status**: ❌ Feature rejected after implementation and testing

**Problem**: Posts use timestamp URLs (`/130000.html`) instead of content-based slugs (`/kubernetes-social-construct.html`)

**Research Conducted**:
1. Tested `name` parameter (Micropub standard for titled posts)
2. Tested `mp-slug` parameter (Micropub extension for custom slugs)
3. Tested show name in title for uniqueness
4. Validated impact on post display format and user experience

**Key Findings**:
- Adding `name` parameter successfully generates content-based URLs
- BUT: Changes posts from "untitled" to "titled" format
- Titled posts display as clickable title + "Continue reading →" link
- Requires extra click-through to see actual content
- Poor UX for content link aggregation use case
- `mp-slug` parameter ignored by Micro.blog despite IndieWeb documentation

**Decision**: Reject content-based URLs, keep timestamp URLs

**Rationale**:
- **Primary use case**: Whitneylee.com aggregates content links (podcasts, videos, talks)
- **Critical UX requirement**: Direct content display on category pages (single click to reach linked content)
- **User feedback**: Titled format with extra click-through is "no bueno"
- **Trade-off accepted**: Timestamp URLs have worse SEO but better UX for this specific use case

**Implementation Actions**:
- Reverted all Milestone 9 code changes
- Removed `generatePostTitle()` helper function
- Removed `name` parameter from `createMicroblogPost()`
- Removed name change detection from `detectChanges()`
- Deleted test scripts and npm commands
- Returned to Milestone 5 implementation

**Impact**:
- All posts remain untitled (timestamp URLs)
- Category pages show direct content without extra clicks
- Consistent UX across all 64 posts
- Milestone 9 marked as cancelled in PRD

**When to Reconsider**:
- If Micro.blog adds theme option to display titled posts inline
- If primary use case shifts from link aggregation to blog content
- If SEO becomes more important than UX for this site

### Decision 18: Automatic URL Regeneration for Non-Title Slugs
**Date**: 2025-10-23
**Status**: ✅ Implemented in Step 5.2.5

### Decision 19: Option B Selected for Milestone 6 - XML-RPC Automated Page Visibility
**Date**: 2025-10-24
**Status**: ✅ Approved for implementation

**Context**: Three options existed for managing category page visibility:
- Option A: Manual page management with activity warnings (simplest)
- Option B: Automated XML-RPC page visibility toggling (more complex)
- Option C: Skip visibility management (pragmatic but poor UX)

**Discovery**: Navigation pages already exist in Micro.blog for all 5 categories:
- Video → `/video` (23 posts)
- Podcast → `/podcast` (19 posts)
- Guest → `/guest` (9 posts)
- Blog → `/blog` (4 posts)
- Presentations → `/presentations` (9 posts)

Each page has "Include this page in your blog navigation" checkbox, controllable via XML-RPC `is_navigation` parameter.

**Decision**: Implement Option B (XML-RPC automated visibility management)

**Rationale**:
- Pages already exist - no need to create them (major simplification)
- Redirects already configured to category URLs
- XML-RPC API supports `microblog.getPages` and `microblog.editPage`
- `is_navigation` parameter controls checkbox state
- Automation provides better UX than manual management
- Effort reduced from 3-4 hours to 2-3 hours due to existing pages

**Implementation Approach**:
1. Query existing pages via `microblog.getPages` (one-time page ID discovery)
2. Map category names to page IDs (persist in code or state)
3. Track category activity in spreadsheet Column I (last post date)
4. Auto-toggle `is_navigation` when categories go stale (4+ months) or reactivate
5. Use same app token authentication as Micropub (username + token)

**Impact**:
- Milestone 6 Step 6.2 updated with simplified workflow
- No page creation logic needed
- Step 6.3 testing focused on XML-RPC validation
- Reduced implementation time due to existing infrastructure

**When to Reconsider**:
- If XML-RPC API proves unreliable or unsupported
- If page ID mapping becomes complex to maintain
- If user prefers manual control after seeing automated behavior

**Discovery**: Micro.blog auto-extracts titles from post content when no `name` parameter is provided, but extraction is inconsistent. Some posts got content-based URLs (`software-defined-interviews-learning-to`), while others got timestamp URLs (`130000`) or hash slugs (`8e237a`).

**Problem**: Inconsistent URL quality across posts affects SEO and professionalism.

**Decision**: Implement automatic URL regeneration during hourly sync

**Implementation**:
- Added `isNonTitleUrl()` detection function with two patterns:
  - Pattern 1: All digits (timestamp URLs like `130000`)
  - Pattern 2: Short hex hashes without hyphens (≤8 chars, like `8e237a`)
- Added Step 5.2.5 in sync flow between creation and updates
- Detects non-title URLs in Column H
- Deletes old post and recreates with same content/date
- Writes new URL back to spreadsheet
- Hourly sync provides natural retry mechanism

**Results**:
- Successfully regenerated 9 posts on initial run
- Most posts now have content-based URLs
- 2 edge cases continue regenerating (Micro.blog fails title extraction consistently for these)
- Edge cases accepted as limitation of Micro.blog's inconsistent title extraction

**Why No Safeguards**:
- Hourly sync prevents infinite loops within single run
- Failed regenerations will retry next hour automatically
- No need for attempt tracking or max retry limits
- Simple, stateless implementation

**Trade-offs**:
- ✅ Most posts get SEO-friendly URLs automatically
- ✅ System self-heals timestamp URLs from past failures
- ✅ No manual intervention required
- ⚠️ 2-3 posts may regenerate repeatedly (acceptable for automation)
- ⚠️ Additional API calls per hour (2 calls per problematic post)

**When to Reconsider**:
- If Micro.blog rate limits become an issue
- If regeneration count grows significantly
- If need to add max attempt tracking to prevent perpetual regeneration

### Decision 20: Confirm 4-Month Inactivity Threshold for Navigation Hiding
**Date**: 2025-10-24
**Status**: ✅ Confirmed

**Context**: User proposed reducing the inactivity threshold from 4 months to 3 months for hiding category navigation pages.

**Clarification**: Navigation hiding applies to entire category sections, not individual posts. When a category has no new posts for the threshold period, the category page is removed from site navigation. All content remains accessible and reappears when new content is published.

**Decision**: Keep 4-month threshold as originally specified

**Rationale**:
- 3 months too aggressive for content types with irregular publishing patterns (presentations, guest appearances)
- 4 months provides breathing room for seasonal gaps without constant navigation flickering
- Balances "keeping site feeling active" with tolerance for temporary pauses

**Impact**: No changes to PRD requirements or implementation approach

## Progress Log

### 2025-10-24 (Milestone 6 Step 6.1 Complete: Activity Tracking Implementation)
**Duration**: ~30 minutes
**Branch**: feature/prd-1-milestone-6-activity-tracking
**Focus**: Category activity tracking for page visibility management

**Completed PRD Items**:
- [x] Step 6.1: Track last post date for each category - Evidence: `calculateCategoryActivity()` function (sync-content.js:800-857)
- [x] Step 6.1: Calculate days since last post - Evidence: Calculates daysSince using date math
- [x] Step 6.1: Identify categories inactive 4+ months - Evidence: 120-day threshold, Guest detected as inactive
- [x] Step 6.1: Log activity status for all categories - Evidence: Activity status section in sync output

**Implementation Highlights**:
- Created `calculateCategoryActivity()` function that analyzes validRows from spreadsheet
- Uses existing `parseDateToISO()` for date parsing - no additional state storage needed
- Added `CATEGORY_PAGE_IDS` constant with page IDs discovered in Step 6.3
- Activity status shows: post count, last post date, days since post, active/inactive status
- Test results: Guest category correctly identified as inactive (139 days), all others active

**Files Modified**:
- `src/sync-content.js` - Added activity tracking function and integration into sync workflow
- Removed task management references from code per user feedback

**Test Results**:
- Podcast: 19 posts, last 09/17/2025 (36 days ago) - Active ✓
- Video: 23 posts, last 09/30/2025 (23 days ago) - Active ✓
- Blog: 4 posts, last 08/22/2025 (62 days ago) - Active ✓
- Presentations: 9 posts, last 09/16/2025 (37 days ago) - Active ✓
- Guest: 9 posts, last 6/6/2025 (139 days ago) - Inactive ✗

**Reflection**:
Discovered 2 posts with "undefined" category during testing. Assistant analysis: "Pizza" rows are correctly filtered out during validation (invalid Type logged as WARN and skipped). The 2 "undefined" posts were from an old bug or manual posts. **Resolution**: Manually deleted both posts through Micro.blog UI. Current validation system prevents new undefined categories from being created, so no code fix needed unless issue recurs.

**Next Session Priority**: Step 6.2 - Implement XML-RPC auto-hide/show logic using activity data

═══════════════════════════════════════

### 2025-10-24 (Milestone 6 Research: XML-RPC API Validation for Page Visibility)
**Duration**: ~3 hours
**Focus**: Research, test, and validate XML-RPC API for automated page visibility management
**Status**: Research phase complete, implementation pending

**Completed PRD Items**:
- [x] Step 6.3: Test XML-RPC authentication - Evidence: Successfully authenticated using MarsEdit token
- [x] Step 6.3: Verify page query returns all category pages - Evidence: `test-xmlrpc.js` queries 14 pages, identifies all 5 category pages
- [x] Step 6.3: Test is_navigation toggle - Evidence: `test-edit-page.js` successfully hides/shows pages, visually verified
- [x] Step 6.3: Document approach - Evidence: Comprehensive XML-RPC guide in `docs/microblog-api-capabilities.md`

**Key Discoveries**:
1. **Two Separate Tokens Required**:
   - Micropub API uses "content-manager" token
   - XML-RPC API requires separate "MarsEdit" token from Account → Edit Apps
   - Using wrong token returns `403 User not authorized`

2. **RSD Discovery for Blog ID**:
   - Found blog ID (169604) via `https://whitneylee.com/rsd.xml`
   - Blog ID required for some XML-RPC methods like `microblog.getPages`

3. **Parameter Order Critical**:
   - `microblog.getPages`: blogID, username, password, numPages, offset
   - `microblog.editPage`: pageID, username, password, content_struct (NOT blogID first!)
   - `microblog.getPage`: pageID, username, password
   - Wrong order causes errors like "Page title can't be blank"

4. **Navigation Pages Pre-exist**:
   - All 5 category pages already configured in Micro.blog
   - Page IDs discovered: Video (897489), Podcast (897417), Guest (897488), Blog (897491), Presentations (897483)
   - No need to create pages, only toggle `is_navigation` parameter

5. **Immediate UI Changes**:
   - `is_navigation` toggle takes effect instantly
   - Visually confirmed "Blog" page disappeared/reappeared from navigation

**Files Created**:
- `src/test-xmlrpc.js` - XML-RPC authentication, page query, and parsing (depth-aware struct parser)
- `src/test-edit-page.js` - Complete hide/show/verify workflow with 2-second propagation delays
- `src/hide-blog-page.js` - Helper script for visual verification
- `src/restore-blog-page.js` - Helper script to restore visibility
- `src/test-metaweblog.js` - MetaWeblog API exploration (unsuccessful, returned HTTP 500)
- `src/test-auth-simple.js` - Basic authentication test with blogger.getUsersBlogs

**Configuration Updates**:
- `.teller.yml` - Added `marsedit_token: MICROBLOG_XMLRPC_TOKEN` mapping
- `.env` - Added `MICROBLOG_USERNAME=wiggitywhitney` and `MICROBLOG_BLOG_ID=169604`

**Documentation Created**:
- Comprehensive 300+ line XML-RPC implementation guide in `docs/microblog-api-capabilities.md`
- Covers authentication requirements, RSD discovery, method parameter orders
- Includes complete working examples, common errors/solutions, XML parsing examples
- Documents all tested use cases with evidence of success

**Testing Results**:
- ✅ XML-RPC authentication successful with MarsEdit token
- ✅ Query all pages returns 14 pages with full metadata
- ✅ Page ID extraction working for all 5 category pages
- ✅ Hide page from navigation verified (Blog page disappeared from whitneylee.com)
- ✅ Show page in navigation verified (Blog page restored to whitneylee.com)
- ✅ Changes persist and queryable via `microblog.getPage`

**Remaining Work for Milestone 6**:
- [ ] Step 6.1: Implement activity tracking (track last post date per category)
- [ ] Step 6.1: Calculate days since last post
- [ ] Step 6.1: Identify categories inactive 4+ months
- [ ] Step 6.1: Log activity status for all categories
- [ ] Step 6.2: Auto-hide pages when category inactive 4+ months
- [ ] Step 6.2: Auto-show pages when new content added
- [ ] Step 6.2: Store page ID mappings in code
- [ ] Step 6.3: Test inactive category detection accuracy
- [ ] Step 6.3: Verify page ID persistence across sync runs

**Decision Made**: Option B selected for Milestone 6 - automated XML-RPC visibility management (documented as Decision 19 in PRD)

**Next Session Priority**: Implement Step 6.1 (activity tracking) and Step 6.2 (auto-toggle logic) to complete Milestone 6

═══════════════════════════════════════

### 2025-10-23 (Post-Implementation Cleanup & Documentation)
**Duration**: ~1 hour
**Focus**: Fix titled post UX issue and update documentation accuracy

**Problem Identified**:
- 55 posts displaying with bolded titles + "Continue reading" link (bad UX - requires two clicks)
- Root cause: Posts retained `name` parameter from Milestone 9 testing
- User feedback: "The UX is terrible and involves clicking into a page before clicking to the content"

**Investigation**:
- Created diagnostic script (`find-titled-posts.js`) to query all Micro.blog posts via Micropub API
- Identified 55 titled posts across managed categories (Podcast: 16, Video: 22, Presentations: 8, Guest: 9)
- Confirmed 3 uncategorized personal posts (left untouched as they're not spreadsheet-managed)
- Verified current sync code does NOT send `name` parameter (correct implementation)

**Solution Implemented**:
- Created fix script (`fix-titled-posts.js`) with two-phase approach:
  1. Delete 55 titled posts from Micro.blog via Micropub delete operation
  2. Clear Column H (Micro.blog URL) in spreadsheet for deleted posts
- Executed fix: 55 posts deleted, 55 Column H cells cleared (0 failures)
- Ran sync script: 55 posts recreated as untitled posts with direct link format
- All posts regenerated successfully with content-based URLs

**Documentation Updates**:
- Fixed README category URLs: `/categories/Podcast/` → `/podcast/` (and all other categories)
- Removed temporary diagnostic and fix scripts after successful completion
- Cleaned up npm scripts in package.json

**Verification**:
- User confirmed fix working on live site: "Fixed! Huzzah!"
- All managed posts now display with good UX (direct links, single click to content)
- 3 personal uncategorized posts retained their titled format (by design)

**System State**:
- 64 posts total in sync (55 recreated + 9 unchanged)
- Consistent untitled post format across all managed categories
- README documentation accurate and up-to-date

**Next Priority**: Consider Milestone 6 (Page Visibility) or Milestone 7 (Error Notifications)

═══════════════════════════════════════

### 2025-10-19 (Implementation Session 12 - Step 5.5 Complete: Full Sync Testing & Milestone 5 Complete)
**Duration**: ~45 minutes
**Focus**: Comprehensive CRUD testing and bug fix for orphan detection
**Branch**: feature/prd-1-microblog-integration

**Completed PRD Items**:
- [x] Step 5.5: Testing Full Sync (all 5 items) - Evidence: Systematic testing of create, update, delete, idempotency
- [x] **Milestone 5: Complete** ✅ - All CRUD operations working with spreadsheet as single source of truth

**Testing Results**:
- ✅ **Idempotency**: Re-running sync shows 0 changes (22 legitimate updates from previous session were timezone normalization fixes)
- ✅ **Create**: Added test row, post created successfully, URL written to Column H
- ✅ **Update**: Modified test row title, post content updated on Micro.blog
- ✅ **Delete**: Removed test rows from spreadsheet, orphan detection found and deleted posts
- ✅ **Partial failures**: Network failures (503 errors) observed in earlier runs, handled gracefully with retry logic and continued processing

**Critical Bug Fixed**:
- **Issue**: Orphan detection was immediately deleting newly created posts
- **Root cause**: `validRows` cached spreadsheet data at script start. After Step 5.2 created posts and wrote URLs to Column H, Step 5.4 orphan detection still used OLD cached data (empty Column H), making new posts appear "orphaned"
- **Solution**: Update in-memory row data after successful URL write (src/sync-content.js:915)
  ```javascript
  row.microblogUrl = postUrl;  // Prevents false orphan detection
  ```
- **Impact**: CREATE operation now works correctly without posts being immediately deleted

**Files Modified**:
- `src/sync-content.js` - 3 line bug fix (line 907, 915) to update in-memory data
- Test scripts created, used, and deleted: `test-create.js`, `test-update.js`, `test-delete.js`

**System State**:
- 64 posts in sync between spreadsheet and Micro.blog
- 0 orphaned posts
- 0 pending updates
- All test content cleaned up

**Next Session Priority**: Milestone 6 (Page Visibility Management) OR Milestone 7 (Error Notifications & Monitoring)

═══════════════════════════════════════

### 2025-10-19 (Implementation Session 11 - Step 5.4 Complete: Delete Detection & Removal)
**Duration**: ~45 minutes
**Focus**: Delete Detection & Removal with client-side category filtering
**Branch**: feature/prd-1-microblog-integration

**Completed PRD Items**:
- [x] Step 5.4: Delete Detection & Removal (all 6 items) - Evidence: src/sync-content.js deletion system
  - `deleteMicroblogPost()` function with 404 handling (lines 665-700)
  - Client-side category filtering to protect uncategorized posts (lines 1010-1016)
  - Orphan detection logic comparing Micro.blog vs spreadsheet (lines 1023-1037)
  - Deletion loop with retry logic and error tracking (lines 1049-1077)
  - Summary statistics integration for deletions (lines 1116-1123, 1189-1204, 1207-1217)

**Implementation Features**:
- **Category filtering**: Protects 18 uncategorized personal posts (photos, books, etc.)
- **Client-side filtering required**: Discovered API quirk where category parameter doesn't actually filter
- **Graceful 404 handling**: Treats already-deleted posts as success
- **Comprehensive statistics**: Tracks checked/orphaned/attempted/successful/failed deletions
- **Partial failure handling**: Continues processing even if some deletions fail

**Testing Results**:
- ✅ Current state: 0 orphaned posts (all 64 categorized posts in spreadsheet)
- ✅ Idempotency verified: Running sync twice shows no changes
- ✅ Statistics display correctly in both JSON and pretty-formatted output
- ✅ Test scripts cleaned up (check-orphaned-posts.js, test-query.js removed)

**Files Modified**:
- `src/sync-content.js` - Added ~75 lines for deletion capability
  - New deleteMicroblogPost() function (lines 665-700)
  - Step 5.4 section with orphan detection (lines 1006-1077)
  - Updated summary statistics (lines 1116-1123, 1189-1204, 1207-1217)

**API Implementation**:
- Delete format: JSON POST with `action: "delete"`, `url` parameters
- Response codes: 200/202 success, 404 treated as success (already deleted)
- Query approach: Fetch all posts, filter client-side by managed categories

**Next Session Priority**: Step 5.5 - Manual testing of create/update/delete operations, complete Milestone 5

═══════════════════════════════════════

### 2025-10-19 (Implementation Session 10 - Step 5.3 Complete: Update Detection)
**Duration**: ~3 hours
**Focus**: Update detection with change comparison and bug fixes
**Branch**: feature/prd-1-microblog-integration

**Completed PRD Items**:
- [x] Step 5.3: Update Detection (all 5 items) - Evidence: src/sync-content.js functions and integration
  - `queryMicroblogPosts()` - Fetches all posts from Micro.blog (lines 502-558)
  - `normalizeTimestamp()` - Fixes timezone format comparison bug (lines 566-572)
  - `detectChanges()` - Compares spreadsheet vs Micro.blog state (lines 580-617)
  - `updateMicroblogPost()` - Updates via Micropub JSON format (lines 619-637)
  - Integrated update detection into sync loop (lines 862-941)

**Critical Bug Fixed**:
- **Date comparison false positives**: Our format `2025-01-09T12:00:00Z` vs Micro.blog's `2025-01-09T12:00:00+00:00`
  - Same timestamp, different string representation
  - Caused every post to be flagged as "changed" even when nothing changed
  - Solution: `normalizeTimestamp()` converts both to standard ISO format before comparison
  - Result: 0 false positives, only real changes detected

**Implementation Features**:
- **Smart change detection**: Only detects actual changes in content, category, or published date
- **Selective updates**: Only sends changed fields to API (not entire post)
- **Efficient querying**: Fetches all posts in 1-2 API calls (100 posts per call)
- **Partial failure handling**: Continues processing even if some updates fail
- **Comprehensive logging**: Tracks attempted, successful, failed updates

**Test Results**:
- ✅ AI Tools Lab successfully moved from Video → Guest category
- ✅ Date comparison working (no false positives)
- ✅ Idempotent behavior confirmed (re-running sync shows 0 updates needed)
- ✅ Update statistics properly logged
- ⚠️ Network issues during testing caused some failures (expected with bad internet)

**API Details**:
- **Query endpoint**: `GET /micropub?q=source&limit=100` with pagination support
- **Update format**: JSON with `action: "update"`, `url`, and `replace` object
- **Content-Type**: `application/json` (not form-encoded like creates)
- **Response**: 200/202 success codes

**Files Modified**:
- `src/sync-content.js` - Added ~160 lines for update detection system
  - Query function with pagination (lines 502-558)
  - Timestamp normalization utility (lines 566-572)
  - Change detection logic (lines 580-617)
  - Micropub update implementation (lines 619-637)
  - Sync loop integration (lines 862-941)
  - Summary statistics updates (lines 971-979, 1021-1043)

**Scaling Discussion**:
- Current approach works well up to ~200 posts (~3 seconds when no changes)
- At 500 posts: ~15 seconds (still acceptable for hourly runs)
- Discussed future optimization strategies:
  - Option 1: Keep as-is (good for 6-12 months)
  - Option 2: Split scripts (new content vs updates)
  - Option 3: Batch processing by date range
  - Option 4: Add "Last Synced" column tracking
- **Decision**: Keep current approach until it becomes a problem

**Next Session Priority**: Step 5.4 - Delete Detection & Removal (orphaned post cleanup)

═══════════════════════════════════════

### 2025-10-19 (Implementation Session 9 - Format Testing & Implementation Learning)
**Duration**: ~2 hours
**Focus**: Post format validation, timezone fixes, cross-posting research
**Branch**: feature/prd-1-microblog-integration

**Work Completed**:
- Tested multiple post format options (newline variants, colon separator)
- Fixed timezone parsing issue causing off-by-one date errors
- Verified backdated post feed placement behavior
- Documented comprehensive implementation learnings in API capabilities doc
- Identified cross-posting risk requiring pre-bulk-operation testing

**Format Design Decisions** (see Decision 12):
- **Final format**: `Show Name: [Title](url)` (colon separator, single line)
- **Podcasts**: Hardcode "Software Defined Interviews"
- **Videos/Others**: Use Column C (Show) from spreadsheet
- **Date parsing**: Manual MM/DD/YYYY parsing with UTC noon to avoid timezone shifts

**Testing Process & Results**:
- ❌ Format attempt 1: Single newline - Rendered as single line without separation
- ❌ Format attempt 2: Double newline - Created unwanted blank line gap
- ❌ Format attempt 3: Markdown soft break (`  \n`) - Didn't render as expected
- ✅ Format attempt 4: Colon separator - Clean visual separation, user approved
- ✅ Timezone fix: Manual MM/DD/YYYY parsing → UTC noon prevents date shifts
- ✅ Feed behavior: Backdated posts appear at correct chronological position
- ✅ Date verification: 01/09/2025 → `/2025/01/09/` (correct URL)

**Testing Insights Documented**:
- Post updates take 1-2 minutes to render (hard refresh required: Cmd+Shift+R)
- New post creation is immediate (seconds)
- Backdated posts don't appear at top of feed (appear at `published` date position)
- Markdown line break behavior differs from expected (documented in capabilities doc)

**Cross-Posting Risk Identified**:
- **Issue**: Micro.blog documentation unclear on backdated post cross-posting behavior
- **Risk**: Bulk-creating 61 posts might spam all connected social accounts (Bluesky, LinkedIn, Mastodon)
- **Uncertainty**: Does "new posts" mean creation time or published date?
- **Required before Step 5.2**: Test 1 backdated post with cross-posting enabled
- **Mitigation**: User can temporarily disable cross-posting before bulk operations

**Files Modified**:
- `docs/microblog-api-capabilities.md` - Added "Implementation Learnings (2025-10-19)" section:
  - Published date behavior and feed placement details
  - Timezone handling solution with code examples
  - Cross-posting uncertainty and testing recommendations
  - Content formatting lessons learned
  - Update operation timing and caching behavior
  - Testing best practices for future work
- `prds/1-automated-content-publishing.md` - Added Decision 12 and updated Post Format section
- `journal/entries/2025-10/2025-10-19.md` - Session documentation

**Future PRD Ideas Captured** (user reflection):
- PRD: Migrate Mastodon/Bluesky to Micro.blog as single source of truth (POSSE approach)
- PRD: Rate-limited posting (1 per day) when bulk-adding new content to avoid follower spam

**Technical Implementation Ready**:
- Date parsing function complete and tested
- Post content format function complete and tested
- Show name logic defined per content type
- Column C (Show) integration specified

**Next Session Priority**:
1. **CRITICAL**: Test cross-posting behavior (create 1 backdated test post, check social accounts)
2. If safe: Test 3 videos (validates per-post show names from Column C)
3. If unsafe: Document mitigation strategy, proceed with cross-posting disabled
4. Begin Step 5.2 implementation (new row detection and post creation)

═══════════════════════════════════════

### 2025-10-19 (Implementation Session 8 - Step 5.1 Complete)
**Duration**: ~45 minutes
**Focus**: Spreadsheet Update Capability (Column H integration)
**Branch**: feature/prd-1-microblog-integration

**Completed PRD Items**:
- [x] Step 5.1: All 5 items - Spreadsheet Update Capability
  - Service account upgraded to Editor permission
  - Column H "Micro.blog URL" header added
  - `writeUrlToSpreadsheet()` function implemented with error handling
  - `parseRow()` updated to extract `microblogUrl` from Column H
  - Auth scope changed from readonly to full spreadsheets access
  - Write functionality tested and verified

**Files Modified**:
- `src/sync-content.js` - Added Column H support and write capability
  - Line 6: Updated RANGE to include Column H
  - Lines 304-322: New `writeUrlToSpreadsheet()` function
  - Line 336: Updated `parseRow()` to extract microblogUrl
  - Line 407: Changed auth scope for write access

**Implementation Features**:
- **Column H Integration**: Spreadsheet now tracks sync state with "Micro.blog URL" column
- **Write Function**: `writeUrlToSpreadsheet(sheets, spreadsheetId, rowIndex, url)` safely writes URLs
- **Error Handling**: Write failures don't crash sync (graceful degradation with WARN logging)
- **Testing**: Created automated test that wrote/verified/cleared test URL in row 3

**Technical Decisions**:
- Used Google Sheets API `values.update()` for writing individual cells
- Kept write operations simple (RAW valueInputOption, single-cell updates)
- Error handling logs warnings but continues sync (resilience over strict consistency)
- Sheet name confirmed as "Sheet1" (not file name "2025_Content_Created")

**Next Session Priority**: Step 5.2 - New Row Detection & Post Creation (integrate Column H with Micropub posting)

═══════════════════════════════════════

### 2025-10-18 (Implementation Session 7 - Milestone 4 Complete)
**Duration**: ~2 hours
**Focus**: Micro.blog Integration & Testing
**Branch**: feature/prd-1-microblog-integration

**Completed PRD Items**:
- [x] Step 4.1: Authentication Setup (all 4 items) - Evidence: Token created, GitHub Secret configured, Micropub config verified
- [x] Step 4.2: Category Strategy (all 4 items) - Evidence: All 5 categories verified in Micro.blog UI
- [x] Step 4.3: Post Creation Logic (all 5 items) - Evidence: Form-encoded POST implementation, error handling
- [x] Step 4.4: Testing (all 5 items) - Evidence: Successfully posted to all 5 categories, verified format on live site
- [x] **Milestone 4: Complete** ✅ - All 18 checkboxes finished

**Files Created/Modified**:
- `.teller.yml` - Added Micro.blog token from Google Secret Manager (secret: `microblog-content-manager`)
- `package.json` - Added/cleaned npm scripts (final state: only `sync` script remains)
- Test scripts created and deleted after successful validation (clean codebase)

**Implementation Features**:
- **Authentication**: App token stored in Google Secret Manager, accessed via Teller for consistency with existing patterns
- **Posting**: Form-encoded Micropub POST with category assignment, Location header parsing
- **Format**: `[Title](URL)\nDate` per PRD requirements, verified on live site
- **Testing**: Created and verified posts in all 5 categories (podcast, video, blog, presentation, guest)
- **Cleanup**: All test posts deleted, test scripts removed for production-ready codebase

**Test Results**:
- ✅ Authentication successful (200 OK, config returned media-endpoint and 2 channels)
- ✅ All 5 categories functional and posts correctly assigned
- ✅ Post format matches PRD requirements (user verified clickable title + date)
- ✅ Delete operations working correctly (all 5 test posts removed)

**Design Decisions**:
- Used Google Secret Manager + Teller for token storage (consistent with Decision 2)
- Deferred navigation page creation to Milestone 6 (categories exist, pages optional)
- Test posts used form-encoded format per Micropub spec recommendation

**Key Milestone 5 Design Decisions Made**:
- **Decision 9: Spreadsheet-Based State Tracking** - Use Column H ("Micro.blog URL") in spreadsheet instead of separate state file
  - Spreadsheet is single source of truth
  - Script writes post URLs back to Column H after creation
  - Simplifies state management (no separate file to maintain)
  - Enables visible sync status directly in spreadsheet
- **Decision 10: Auto-Delete Orphaned Posts** - Query Micro.blog posts, delete any not in spreadsheet
  - True bidirectional sync: spreadsheet row deletion = post deletion
  - Safer than manual cleanup
- **Decision 11: Chronological Ordering via Published Date** - Use `published` parameter with Date column value
  - Posts appear in correct chronological order regardless of creation order
  - Can backfill old content without timeline disruption
  - Confirmed in Micropub API docs (line 92)

**Next Session Priority**: Milestone 5 - Spreadsheet Write Capability & Full CRUD Integration

### 2025-10-18 (Implementation Session 6 - Milestone 3 Complete)
**Duration**: ~50 minutes (~45 min coding + 5 min PR)
**Focus**: Error Handling & Logging
**Branch**: milestone-3-error-handling
**PR**: #5
**Commits**: 6d80b64

**Completed PRD Items**:
- [x] Add proper error handling for API failures - Evidence: Error classification system (src/sync-content.js:8-86)
- [x] Implement structured logging with different log levels - Evidence: LogLevel system with DEBUG/INFO/WARN/ERROR (src/sync-content.js:165-264)
- [x] Test failure scenarios - Evidence: Invalid credentials test, normal operation verified
- [x] Document error recovery behavior - Evidence: Comprehensive inline documentation (src/sync-content.js:8-39)
- [x] **Milestone 3: Complete** ✅ - All 4 checkboxes finished

**Files Created/Modified**:
- `src/sync-content.js` - Added 328 lines (error classification, retry logic, enhanced logging)
- `workflow-experiment.md` - New experiment tracking doc

**Implementation Features**:
- **Error Classification**: 5 error types (AUTH, NETWORK, API_RATE_LIMIT, DATA, UNKNOWN) with smart retry decisions
- **Retry Logic**: Exponential backoff (1s → 2s → 4s, max 30s), max 3 attempts
- **Enhanced Logging**: Multi-level (DEBUG/INFO/WARN/ERROR), JSON format for CI, structured data support
- **Environment Variables**: LOG_LEVEL, LOG_FORMAT for configuration

**CodeRabbit Review Findings** (PR #5):
- 3 minor bugs identified (LOG_LEVEL bypass, stderr routing, importability)
- 3 nice-to-have improvements suggested (Retry-After header, jitter, broader error classification)
- 60% signal-to-noise ratio - review caught real issues

**Workflow Experiment Results**:
- PR overhead: 10% (5 min / 50 min total)
- CodeRabbit review valuable (caught bugs)
- **Decision**: Continue with grouped milestones (Milestones 4+5 together)

**Next Session Priority**: Address CodeRabbit bugs OR merge and proceed to Milestone 4 - Micro.blog Integration

### 2025-10-18 (Implementation Session 5 - Milestone 2 Complete)
**Duration**: ~1 hour
**Focus**: GitHub Actions Integration
**Commits**: f236ffa, f47c747

**Completed PRD Items**:
- [x] Create `.github/workflows/sync-content.yml` - Evidence: Workflow file with manual trigger, Node.js 18 setup, npm caching
- [x] Configure GitHub Secrets for service account credentials - Evidence: `GOOGLE_SERVICE_ACCOUNT_JSON` secret configured via `gh secret set`
- [x] Set up scheduled workflow - Evidence: Manual trigger (`workflow_dispatch`) tested successfully, hourly cron schedule configured but commented out
- [x] Verify workflow runs successfully - Evidence: Workflow run 18612282027 completed successfully, processed 61 valid content items
- [x] **Milestone 2: Complete** ✅ - All 4 checkboxes finished

**Files Created/Modified**:
- `.github/workflows/sync-content.yml` - GitHub Actions workflow with manual trigger and commented hourly schedule
- GitHub Secret: `GOOGLE_SERVICE_ACCOUNT_JSON` - Service account credentials from Google Secret Manager

**Workflow Features**:
- **Manual Trigger**: `workflow_dispatch` for on-demand testing
- **Node.js Setup**: Version 18 with npm dependency caching
- **Production Dependencies**: Uses `npm ci --omit=dev` to skip devDependencies (avoids local file reference issues)
- **Secret Injection**: Passes `GOOGLE_SERVICE_ACCOUNT_JSON` as environment variable
- **Scheduled Run**: Hourly cron schedule ready but commented out (deferred to Milestone 4)

**Test Results** (Workflow Run 18612282027):
- **Status**: ✅ Success (25 seconds runtime)
- **Total rows**: 89 processed (including header)
- **Valid content**: 61 items identified
  - 19 Podcast → /podcast
  - 26 Video → /video
  - 4 Blog → /blog
  - 6 Presentation → /presentation
  - 6 Guest → /guest
- **Skipped**: 27 rows (9 month headers, 8 empty, 4 invalid type, 6 missing fields)
- **Verification**: Identical output to local runs with `npm run sync`

**Implementation Notes**:
- Fixed initial workflow failure by adding `--omit=dev` flag to skip commit-story devDependency (local file reference not available in CI)
- Service account credentials work seamlessly in both environments (Teller locally, GitHub Secrets in CI)
- Script requires no modifications between local and CI execution

**Design Decision**: Deferred enabling hourly schedule to Milestone 4 to avoid wasting GitHub Actions minutes on logs that don't yet produce business value (Micro.blog posting not implemented).

**Next Session Priority**: Milestone 3 - Error Handling & Logging OR skip to Milestone 4 - Micro.blog Integration

### 2025-10-17 (Implementation Session 4 - Milestone 1 Complete)
**Duration**: ~50 minutes
**Focus**: Steps 1.4-1.6 - Comprehensive Script Development (Parsing, Validation, Logging)

**Completed PRD Items**:
- [x] Step 1.4: Parse into Basic Objects (all 4 checkboxes) - Evidence: `src/sync-content.js` created with `parseRow()` function
- [x] Step 1.5: Add Simple Validation (all 5 checkboxes) - Evidence: `validateContent()` function with full validation logic
- [x] Step 1.6: Add Pretty Logging (all 4 checkboxes) - Evidence: Timestamp formatting, visual indicators, type breakdown summary
- [x] **Milestone 1: Complete** ✅ - All 6 steps (1.1-1.6) finished

**Files Created/Modified**:
- `src/sync-content.js` - Comprehensive 223-line script implementing all three steps as one evolving codebase
- `package.json` - Added `sync` npm script for running the comprehensive script

**Script Capabilities**:
- **Parsing**: Converts raw spreadsheet arrays to structured objects with named fields (Name, Type, Show, Date, Location, Confirmed, Link)
- **Validation**: Enforces required fields (Name, Type, Date, Link), handles month headers gracefully, validates Type against 5 standard values
- **Logging**: Timestamped output `[YYYY-MM-DD HH:MM:SS]`, visual indicators (✓/✗), comprehensive statistics with type breakdown

**Test Results** (`npm run sync`):
- **Total rows**: 88 processed
- **Valid content**: 61 items identified
  - 19 Podcast → /podcast
  - 26 Video → /video
  - 4 Blog → /blog
  - 6 Presentation → /presentation
  - 6 Guest → /guest
- **Skipped**: 27 rows (9 month headers, 8 empty, 4 invalid type, 6 missing fields)

**Implementation Approach**:
- Followed comprehensive script strategy (avoid intermediate throwaway scripts)
- Single evolving codebase that progressively added parsing → validation → logging
- Clean separation of concerns with helper functions for parsing, validation, and formatting

**Next Session Priority**: Milestone 2 - GitHub Actions Integration (configure CI/CD workflow, GitHub Secrets)

### 2025-10-17 (Implementation Session 3 - Spreadsheet Standardization)
**Duration**: ~45 minutes
**Focus**: Decision 5 Implementation - Spreadsheet Type Standardization

**Completed Work**:
- [x] Enabled Google Sheets API in GCP project - Evidence: `gcloud services enable sheets.googleapis.com`
- [x] Created automated Type standardization script - Evidence: `src/update-spreadsheet-types.js` (created and deleted after use)
- [x] Temporarily granted service account Editor permission for one-time update
- [x] Successfully ran standardization script - Evidence: 55 cells updated, dropdown validation added
- [x] Reverted service account to Viewer permission (security best practice)
- [x] Cleaned up one-time script and npm command
- [x] Created PRD #5 for GitHub Coding Projects (future work, separate data pipeline)

**Spreadsheet Changes (Permanent)**:
- 55 Type values standardized to: Podcast, Video, Blog, Presentation, Guest
- Dropdown validation added to Type column with 5 standard values
- 7 unmapped values left for manual handling: Pizza, Credential, Coding Project, Teaching Assistant

**Files Created/Modified**:
- `prds/5-github-coding-projects-auto-sync.md` - New PRD for future GitHub integration
- `package.json` - Temporarily added/removed `update-types` script
- PRD #1 Decision 5 - Updated with implementation summary

**Design Discussion**:
- Evaluated hybrid vs full GitHub automation for coding projects
- Decided on separate PRD (#5) for GitHub-aware Coding Projects feature
- Deferred PRD #5 until PRD #1 (Milestones 1-8) complete

**Next Session Priority**: Step 1.3 - Read Raw Spreadsheet Data (now unblocked with standardized Type values)

### 2025-10-17 (Implementation Session 2)
**Duration**: ~20 minutes
**Focus**: Milestone 1, Step 1.2 - "Hello World" with Google API

**Completed PRD Items**:
- [x] Create service account in Google Cloud Console - Evidence: `content-manager-sheets@demoo-ooclock.iam.gserviceaccount.com` created
- [x] Upload service account JSON to Google Secret Manager - Evidence: Secret `content_manager_service_account` created (version 1)
- [x] Create `.teller.yml` configuration - Evidence: `.teller.yml` file with proper google_secretmanager mapping
- [x] Share spreadsheet with service account - Evidence: Spreadsheet shared with Viewer permission
- [x] Create authentication script - Evidence: `src/auth-test.js` created with full error handling
- [x] Verify authentication works - Evidence: Successfully ran `npm run auth-test`, obtained access token

**Files Created/Modified**:
- `.teller.yml` - Teller configuration for local secret management
- `src/auth-test.js` - Google Sheets API authentication test script
- `package.json` - Added `auth-test` npm script with proper Teller command

**Verification**:
- Successfully ran `gcloud secrets create content_manager_service_account`
- Successfully ran `npm run auth-test` (authentication confirmed with ✅ output)
- Verified service account email: `content-manager-sheets@demoo-ooclock.iam.gserviceaccount.com`
- Cleaned up local credentials file for security

**Implementation Divergence**:
- Original plan specified local file storage (`credentials/service-account.json`)
- Implemented Teller + Secret Manager approach per Decision 2 (better security, consistent with existing patterns)

**Next Session Priority**: Step 1.3 - Read Raw Spreadsheet Data (connect to actual spreadsheet and read data)

### 2025-10-19 (Implementation Session - Milestone 5, Step 5.2)
**Duration**: ~3 hours
**Focus**: Milestone 5, Step 5.2 - New Row Detection & Post Creation
**Commits**: Multiple implementation and fix commits

**Completed PRD Items**:
- [x] Step 5.2: New Row Detection & Post Creation - Evidence: sync-content.js lines 641-710, all 6 sub-tasks completed
  - Date parsing to ISO 8601 (UTC noon) in `parseDateToISO()` function (lines 440-475)
  - Post content formatting with keynote support in `formatPostContent()` (lines 399-441)
  - Micropub post creation in `createMicroblogPost()` (lines 443-487)
  - Column H filtering and write-back integration (lines 641-710)
  - Partial failure handling with error tracking (lines 700-709)
  - Creation statistics logging (lines 765-791)

**Implementation Highlights**:
- **61 posts successfully created** from spreadsheet rows with empty Column H
- **100% success rate** - all posts created and URLs written back to spreadsheet
- **Keynote support**: Implemented `[Keynote] Show Name: [Title](url)` format based on Column F marker
- **Category mapping**: Updated to title case (Podcast, Video, Blog, Presentations, Guest)
- **Presentations without URLs**: Allowed presentations to be listed with plain text titles (no hyperlink required)
- **Template string bug fix**: Fixed `name` variable interpolation for linkless content

**Files Created/Modified**:
- `src/sync-content.js` - Added post creation logic, date parsing, content formatting, Micropub integration
- Spreadsheet - 61 URLs written to Column H, 9 Presentations rows updated to "Presentations" type

**Bugs Fixed**:
- Statistics byType initialization missing "Presentations" key
- Validation rejected "Presentations" type (updated validTypes array)
- Content formatting missing template string interpolation for linkless titles
- Category mapping used lowercase/singular (updated to title case/plural)

**Test Data**:
- **AI Tools Lab test case prepared**: Row 48 Type changed from "Video" to "Guest" for Step 5.3 testing (documented in PRD)
- **6 duplicate test posts deleted**: Cleaned up from earlier testing sessions
- **3 old presentation posts migrated**: Updated category from "presentation" to "Presentations"

**Design Decisions Made**:
- Decision 13: Category naming - "Presentations" (plural, title case) for consistency with Micro.blog UI
- Decision 14: Presentations without URLs - Allowed for tracking talks that don't have recordings yet
- Decision 15: Date timezone handling - UTC noon to avoid timezone-related date shifts

**Verification**:
- All 61 posts visible on whitneylee.com with correct categories
- All 9 presentations showing at /presentations/ including 2 without URLs
- Keynote prefix working correctly: `[Keynote] DevOpsDays Rockies: ...`
- Post content format verified across all 5 content types

**Next Session Priority**: Step 5.3 - Update Detection (AI Tools Lab test case ready for testing)

### 2025-10-17 (Implementation Session 1)
**Duration**: ~10 minutes
**Focus**: Milestone 1, Step 1.1 - Environment Setup

**Completed PRD Items**:
- [x] Install `googleapis` npm package - Evidence: package.json shows googleapis@164.0.0
- [x] Install `dotenv` npm package - Evidence: package.json shows dotenv@17.2.3
- [x] Create basic project structure (`src/` folder) - Evidence: src/ directory created
- [x] Create simple test script that prints "Hello from content-manager!" - Evidence: src/test.js created and verified working

**Files Created/Modified**:
- `package.json` - Added googleapis and dotenv dependencies
- `src/test.js` - Simple hello world test script
- `src/` directory - Created project structure

**Verification**:
- Successfully ran `npm install` (24 packages added, 0 vulnerabilities)
- Successfully ran `node src/test.js` (verified with Node v24.5.0)

**Next Session Priority**: Step 1.2 - "Hello World" with Google API (create service account and authenticate)

### 2025-10-17 (Planning Session)
- **PRD Structure Update**: Restructured implementation milestones - broke Foundation Setup into 3 separate milestones for better progress tracking
- **Milestone Count**: Increased from 6 to 8 total milestones
- **Milestone 1 Breakdown**: Further broke Milestone 1 into 6 small sub-steps (1.1-1.6) to reduce complexity and enable incremental progress
  - Working approach: Complete one sub-step at a time
  - Each step is 5-20 minutes with clear success criteria
- **Design Decisions**: Added 5 new design decisions (Decisions 4-8) based on Milestone 1 planning discussions:
  - Decision 4: Dedicated service account with minimal permissions
  - Decision 5: Standardized spreadsheet Type values with dropdown validation
  - Decision 6: Flexible data validation approach with graceful month header handling
  - Decision 7: Environment-specific logging strategy (pretty for dev, JSON for prod)
  - Decision 8: GitHub Actions first, Azure migration path for future learning
- **Updated Decision 2**: Revised secret management to hybrid approach (Teller for local, GitHub Secrets for CI)
- **Spreadsheet Analysis**: Analyzed actual data structure and identified standardization needs

### 2025-10-04
- **Design Decisions**: Finalized JavaScript/Node.js, GitHub Secrets, and task breakdown
- **Status Updated**: Changed from Planning to In Progress

### 2025-09-26
- **PRD Created**: Initial requirements gathering and documentation
- **GitHub Issue**: [#1](https://github.com/wiggitywhitney/content-manager/issues/1) created

---

*This PRD will be updated as implementation progresses and requirements are refined.*
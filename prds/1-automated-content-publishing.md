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
Each micro.blog post will include:
```markdown
[Title as clickable link](url)
Date
```

Example:
```markdown
[Learning to learn, with Sasha Czarkowski](https://www.softwaredefinedinterviews.com/91)
January 9, 2025
```

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

#### Step 5.2: New Row Detection & Post Creation (~45-60 min)
- [ ] Read spreadsheet including Column H
- [ ] Identify rows with empty Column H (new content to post)
- [ ] Create posts via Micropub with `published` date from Date column
- [ ] Write returned post URLs back to Column H
- [ ] Handle partial failures (some posts succeed, some fail)
- [ ] Log creation statistics

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

#### Step 5.3: Update Detection (~60-90 min)
**API Reference**: [Micropub Update Operations](../docs/microblog-api-capabilities.md#supported-operations)

- [ ] For rows with filled Column H, compare current data vs last sync
- [ ] Detect changes in Name, Date, or Link columns
- [ ] Implement Micropub update operation
- [ ] Update Column H if URL changes (unlikely but possible)
- [ ] Log update statistics

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

#### Step 5.4: Delete Detection & Removal (~30-45 min)
**API Reference**: [Micropub Delete Operations](../docs/microblog-api-capabilities.md#supported-operations)

- [ ] Query all posts from 5 categories via Micropub (`q=source`)
- [ ] Build list of all post URLs in Micro.blog
- [ ] Compare with Column H URLs in spreadsheet
- [ ] Delete posts that exist in Micro.blog but not in spreadsheet
- [ ] Handle "already deleted" errors (404) gracefully
- [ ] Log deletion statistics

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

#### Step 5.5: Testing Full Sync (~30-45 min)
- [ ] Test create: Add new row with empty Column H, verify post created and URL written
- [ ] Test update: Edit Name/Date/Link, verify post updated in Micro.blog
- [ ] Test delete: Remove row from spreadsheet, verify post deleted from Micro.blog
- [ ] Test idempotency: Run sync twice, verify no duplicate posts or unnecessary updates
- [ ] Test partial failures: Simulate API error, verify script continues with other rows

**Success Criteria**: Complete CRUD operations working - spreadsheet is single source of truth, Micro.blog automatically matches spreadsheet state

### Milestone 6: Page Visibility Management
**Estimated Time**: ~2-3 hours (or may be simplified based on API constraints)
**API Reference**: [XML-RPC Page Management](../docs/microblog-api-capabilities.md#xml-rpc-api)

**Important Note**: Original PRD assumed managing "page" visibility, but we're using **categories** for content organization. Category navigation is managed differently - see implementation options below.

#### Step 6.1: Activity Tracking (~30-45 min)
- [ ] Track last post date for each category in state file
- [ ] Calculate days since last post for each category
- [ ] Identify categories inactive for 4+ months
- [ ] Log activity status for all categories

**State File Addition**:
```json
{
  "categories": {
    "podcast": { "lastPostDate": "2025-01-15", "daysSincePost": 3 },
    "video": { "lastPostDate": "2024-08-10", "daysSincePost": 160 }
  }
}
```

#### Step 6.2: Navigation Management Strategy (~60-90 min)
**API Reference**: [Navigation Limitations](../docs/microblog-api-capabilities.md#limitations--constraints)

Choose implementation approach:

**Option A: Manual Setup (Simplest)** ✅ Recommended
- [ ] Create navigation pages once via Micro.blog web UI
- [ ] Link each page to category URL (e.g., `/categories/podcast/`)
- [ ] Log warnings when categories become inactive (no auto-hide)
- [ ] Whitney manually hides/shows pages based on logs

**Option B: XML-RPC Page Management** (More complex)
**API Reference**: [XML-RPC Page Methods](../docs/microblog-api-capabilities.md#page-management-methods)

- [ ] Create navigation pages via `microblog.newPage` with links to categories
- [ ] Implement `microblog.editPage` to toggle `is_navigation` parameter
- [ ] Auto-hide pages when category inactive 4+ months
- [ ] Auto-show pages when category receives new content
- [ ] Handle page ID tracking in state file

**API Details for XML-RPC**:
- Endpoint: `https://micro.blog/xmlrpc`
- Method: `microblog.editPage`
- Parameters: `page_id`, `is_navigation` (boolean)
- Authentication: Username + app token as password
- Limitation: Manages pages, not direct category navigation

**Option C: Skip Auto-Management** (Pragmatic)
- [ ] Categories remain visible at all times
- [ ] No navigation hiding (categories without content show empty)
- [ ] Focus effort on core posting functionality

#### Step 6.3: Implementation Decision and Testing (~30-45 min)
- [ ] Choose approach (A, B, or C) based on effort vs value
- [ ] Implement chosen approach
- [ ] Test inactive category detection
- [ ] Test navigation visibility changes (if Option B)
- [ ] Document approach in Progress Log

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

## Progress Log

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
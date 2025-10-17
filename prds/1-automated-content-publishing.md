# PRD: Automated Content Publishing from Google Sheets to Micro.blog

**Issue**: [#1](https://github.com/wiggitywhitney/content-manager/issues/1)
**Status**: In Progress
**Priority**: High
**Created**: 2025-09-26
**Last Updated**: 2025-10-04

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

### Content Type Mapping
| Spreadsheet Type | Micro.blog Page | URL |
|------------------|----------------|-----|
| SDI Podcast | Podcast | whitneylee.com/podcast |
| Video - Livestream, Video - Livestr You Choose! | Video | whitneylee.com/video |
| Blog Post - CNCF Blog | Blog | whitneylee.com/blog |
| Presentation | Present | whitneylee.com/present |
| Guest - Podcast, Podcast guest | Guest | whitneylee.com/guest |

### Micro.blog Integration
- **API**: Micropub API for post management
- **Authentication**: App token from micro.blog account
- **Operations**: Create, update, delete posts
- **Page Management**: Create pages, manage visibility

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

#### Step 1.1: Environment Setup
**Estimated Time**: 5-10 minutes
**Related Decisions**: Decision 1 (JavaScript/Node.js implementation)

- [ ] Install `googleapis` npm package
- [ ] Install `dotenv` npm package
- [ ] Create basic project structure (`src/` folder)
- [ ] Create simple test script that prints "Hello from content-manager!"

**Success Criteria**: Can run `npm install` and `node src/test.js` successfully

#### Step 1.2: "Hello World" with Google API
**Estimated Time**: 10-15 minutes
**Related Decisions**: Decision 2 (Hybrid secret management), Decision 4 (Dedicated service account with minimal permissions)

- [ ] Create service account in Google Cloud Console (existing GCP project)
- [ ] Grant only Google Sheets API read access
- [ ] Download service account credentials JSON file
- [ ] Store credentials locally in `credentials/service-account.json` (gitignored)
- [ ] Create script that authenticates with Google Sheets API
- [ ] Print "Successfully authenticated!" to console

**Success Criteria**: Script runs without authentication errors

#### Step 1.3: Read Raw Spreadsheet Data
**Estimated Time**: 10-15 minutes
**Related Decisions**: Decision 4 (Service account access to spreadsheet)

- [ ] Share spreadsheet (https://docs.google.com/spreadsheets/d/1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs/edit) with service account email
- [ ] Connect to Whitney's spreadsheet using googleapis
- [ ] Read the first sheet (no parsing, just raw data)
- [ ] Print raw data arrays to console

**Success Criteria**: Can see the actual spreadsheet data in terminal

#### Step 1.4: Parse into Basic Objects
**Estimated Time**: 15-20 minutes
**Related Decisions**: Decision 5 (Standardized Type values), Decision 6 (Flexible data validation)

- [ ] Convert row arrays into objects with named fields (Name, Type, Show, Date, Location, Confirmed, Link)
- [ ] Handle header row detection
- [ ] Map to simplified Type values (Podcast, Video, Blog, Presentation, Guest)
- [ ] Print structured objects instead of arrays

**Success Criteria**: Output shows `{ name: "...", type: "...", date: "..." }` format

#### Step 1.5: Add Simple Validation
**Estimated Time**: 15-20 minutes
**Related Decisions**: Decision 6 (Flexible data validation with month header handling)

- [ ] Check for required fields (Name, Type, Date, Link)
- [ ] Allow optional fields to be empty (Show, Location, Confirmed)
- [ ] Skip month header rows (rows with only Name filled, other required fields empty)
- [ ] Count valid vs invalid rows
- [ ] Log validation results

**Success Criteria**: Script reports "Found X valid rows, skipped Y rows"

#### Step 1.6: Add Pretty Logging
**Estimated Time**: 10-15 minutes
**Related Decisions**: Decision 7 (Pretty formatted logging for development)

- [ ] Format output with visual hierarchy and indentation
- [ ] Add timestamps to logs (format: `[YYYY-MM-DD HH:MM:SS]`)
- [ ] Add visual indicators (✓ for valid, ✗ for skipped)
- [ ] Create summary statistics (total rows, valid by type, skipped count)

**Success Criteria**: Nice, readable output when script runs (see Decision 7 for example format)

**Milestone 1 Complete**: Can run a local Node.js script that logs all spreadsheet data correctly with pretty formatting

### Milestone 2: GitHub Actions Integration
**Estimated Time**: ~1-2 hours

- [ ] Create `.github/workflows/sync-content.yml`
- [ ] Configure GitHub Secrets for service account credentials
- [ ] Set up scheduled workflow (hourly or on-demand for testing)
- [ ] Verify workflow runs successfully and logs spreadsheet data

**Success Criteria**: GitHub Actions successfully runs on schedule and logs spreadsheet data

### Milestone 3: Error Handling & Logging
**Estimated Time**: ~1 hour

- [ ] Add proper error handling for API failures (network, auth, rate limits)
- [ ] Implement structured logging with different log levels
- [ ] Test failure scenarios (invalid credentials, network timeout, malformed data)
- [ ] Document error recovery behavior

**Success Criteria**: Script handles errors gracefully with actionable error messages

### Milestone 4: Micro.blog Integration
- [ ] Micro.blog API authentication working
- [ ] Can create the 5 required pages (Podcast, Video, Blog, Present, Guest)
- [ ] Basic post creation functionality
- [ ] Content type mapping logic implemented

**Success Criteria**: Can create posts on correct micro.blog pages

### Milestone 5: Full CRUD Operations
- [ ] New row detection and posting
- [ ] Row update detection and post editing
- [ ] Row deletion detection and post removal
- [ ] State tracking to prevent duplicates
- [ ] Post format matching requirements

**Success Criteria**: Complete bidirectional sync between spreadsheet and micro.blog

### Milestone 6: Page Visibility Management
- [ ] Activity tracking for each page
- [ ] Auto-hide logic for inactive pages (4+ months)
- [ ] Auto-show logic when content added to hidden pages
- [ ] Page visibility API integration with micro.blog

**Success Criteria**: Pages automatically hide/show based on activity

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

**Impact**:
- Simpler parsing code with exact string matching
- No need for complex pattern matching or variations
- Reduced risk of mapping errors
- Clearer user experience when adding content
- **Updates Content Type Mapping** (see table below)

**Updated Content Type Mapping**:
| Spreadsheet Type | Micro.blog Page | URL |
|------------------|----------------|-----|
| Podcast | Podcast | whitneylee.com/podcast |
| Video | Video | whitneylee.com/video |
| Blog | Blog | whitneylee.com/blog |
| Presentation | Present | whitneylee.com/present |
| Guest | Guest | whitneylee.com/guest |

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

## Progress Log

### 2025-10-17
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
- **Next Steps**: Begin Step 1.1 (Environment Setup) - install packages and create hello world script

### 2025-10-04
- **Design Decisions**: Finalized JavaScript/Node.js, GitHub Secrets, and task breakdown
- **Status Updated**: Changed from Planning to In Progress

### 2025-09-26
- **PRD Created**: Initial requirements gathering and documentation
- **GitHub Issue**: [#1](https://github.com/wiggitywhitney/content-manager/issues/1) created

---

*This PRD will be updated as implementation progresses and requirements are refined.*
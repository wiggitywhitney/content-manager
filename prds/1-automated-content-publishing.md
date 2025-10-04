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

### Milestone 1: Foundation Setup

**Implementation broken into 3 focused tasks:**

#### Task 1: Google Sheets API Setup & Local Testing (~2 hours)
- [ ] Set up Google Cloud service account with Sheets API access
- [ ] Create Node.js script that reads the spreadsheet using `googleapis` npm package
- [ ] Parse and validate all columns (Name, Type, Show, Date, Location, Confirmed, Link)
- [ ] Test locally with service account credentials
- [ ] Add structured logging for parsed data

**Success Criteria**: Can run a local Node.js script that logs all spreadsheet data correctly

#### Task 2: GitHub Actions Integration (~1-2 hours)
- [ ] Create `.github/workflows/sync-content.yml`
- [ ] Configure GitHub Secrets for service account credentials
- [ ] Set up scheduled workflow (hourly or on-demand for testing)
- [ ] Verify workflow runs successfully and logs spreadsheet data

**Success Criteria**: GitHub Actions successfully runs on schedule and logs spreadsheet data

#### Task 3: Error Handling & Logging (~1 hour)
- [ ] Add proper error handling for API failures (network, auth, rate limits)
- [ ] Implement structured logging with different log levels
- [ ] Test failure scenarios (invalid credentials, network timeout, malformed data)
- [ ] Document error recovery behavior

**Success Criteria**: Script handles errors gracefully with actionable error messages

### Milestone 2: Micro.blog Integration
- [ ] Micro.blog API authentication working
- [ ] Can create the 5 required pages (Podcast, Video, Blog, Present, Guest)
- [ ] Basic post creation functionality
- [ ] Content type mapping logic implemented

**Success Criteria**: Can create posts on correct micro.blog pages

### Milestone 3: Full CRUD Operations
- [ ] New row detection and posting
- [ ] Row update detection and post editing
- [ ] Row deletion detection and post removal
- [ ] State tracking to prevent duplicates
- [ ] Post format matching requirements

**Success Criteria**: Complete bidirectional sync between spreadsheet and micro.blog

### Milestone 4: Page Visibility Management
- [ ] Activity tracking for each page
- [ ] Auto-hide logic for inactive pages (4+ months)
- [ ] Auto-show logic when content added to hidden pages
- [ ] Page visibility API integration with micro.blog

**Success Criteria**: Pages automatically hide/show based on activity

### Milestone 5: Error Handling & Monitoring
- [ ] Comprehensive error catching and logging
- [ ] Email notification system for errors
- [ ] GitHub issue creation for persistent failures
- [ ] Retry logic with exponential backoff
- [ ] Health check and status reporting

**Success Criteria**: System handles errors gracefully and notifies appropriately

### Milestone 6: Production Deployment
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

### Decision 2: Use GitHub Secrets Instead of External Secret Management
**Date**: 2025-10-04
**Rationale**:
- This is a single scheduled GitHub Actions job with minimal secret needs
- GitHub Secrets provides everything needed: encryption, access control, injection into workflows
- External solutions (GCP Secret Manager + teller) add unnecessary complexity:
  - Additional API calls that can fail
  - Extra dependencies to install in CI
  - More IAM permissions to manage
  - Workload Identity Federation setup
- Keep it simple: use the right tool for the job size

**Impact**:
- Milestone 1 Task 2 will use GitHub Secrets for service account credentials
- Simpler workflow configuration
- Fewer external dependencies and failure points
- Faster development iteration

**When to Reconsider**: If secrets need to be shared across multiple systems (multiple CIs, local dev, production), or if compliance requires centralized secret rotation, revisit external secret management.

### Decision 3: Break Milestone 1 Into 3 Focused Tasks
**Date**: 2025-10-04
**Rationale**:
- Original milestone was too large (4-6 hours) as a single atomic unit
- 7 smaller subtasks were too granular (15-30 minutes each)
- 3 tasks provide meaningful, independently testable chunks:
  - Task 1: Core functionality working locally
  - Task 2: CI/CD integration
  - Task 3: Production-ready error handling

**Impact**:
- Better progress tracking with meaningful milestones
- Each task delivers concrete, testable value
- Easier to pause/resume work between tasks
- Clearer success criteria for each stage

## Progress Log

### 2025-10-04
- **Design Decisions**: Finalized JavaScript/Node.js, GitHub Secrets, and task breakdown
- **Status Updated**: Changed from Planning to In Progress
- **Next Steps**: Begin Milestone 1, Task 1 (Google Sheets API Setup & Local Testing)

### 2025-09-26
- **PRD Created**: Initial requirements gathering and documentation
- **GitHub Issue**: [#1](https://github.com/wiggitywhitney/content-manager/issues/1) created

---

*This PRD will be updated as implementation progresses and requirements are refined.*
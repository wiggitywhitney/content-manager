# PRD: Automated Content Publishing from Google Sheets to Micro.blog

**Issue**: [#1](https://github.com/wiggitywhitney/content-manager/issues/1)
**Status**: Planning
**Priority**: High
**Created**: 2025-09-26
**Last Updated**: 2025-09-26

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
- **Language**: Python or JavaScript (TBD based on API client availability)
- **Storage**: GitHub repository files for tracking state
- **APIs**: Google Sheets API, Micro.blog Micropub API

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
- [ ] GitHub repository configured with Actions
- [ ] Google Sheets API integration working
- [ ] Basic spreadsheet reading functionality
- [ ] Secure credential management in GitHub Secrets

**Success Criteria**: Can read and parse spreadsheet data on schedule

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

## Progress Log

### 2025-09-26
- **PRD Created**: Initial requirements gathering and documentation
- **GitHub Issue**: [#1](https://github.com/wiggitywhitney/content-manager/issues/1) created
- **Next Steps**: Begin Milestone 1 implementation

---

*This PRD will be updated as implementation progresses and requirements are refined.*
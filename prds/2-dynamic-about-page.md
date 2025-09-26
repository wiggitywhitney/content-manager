# PRD: Dynamic About Page with Content Highlights

**Issue**: [#2](https://github.com/wiggitywhitney/content-manager/issues/2)
**Status**: Planning
**Priority**: Medium
**Created**: 2025-09-26
**Last Updated**: 2025-09-26

## Problem Statement

Whitney's about page on her micro.blog site is currently static and doesn't reflect her latest achievements or content she's particularly proud of. This creates several issues:

- **Missed opportunities**: Outstanding content that could showcase her expertise gets buried over time
- **Stale representation**: Visitors don't see her most impactful recent work
- **Manual maintenance burden**: Any updates to the about page require manual intervention
- **Lack of engagement**: Static about pages don't encourage visitors to explore recent content
- **Professional branding gap**: No systematic way to highlight career-defining moments or achievements

## Solution Overview

Create a dynamic about page that automatically features the most recent content Whitney marks as "highlight-worthy" in her Google Sheets tracker. The system will:

1. **Extend spreadsheet schema** with a "Highlight" column to mark showcase-worthy content
2. **Generate dynamic about page** featuring the most recent highlighted content
3. **Implement smart fallbacks** when highlighted content becomes stale (3+ months old)
4. **Integrate with existing sync system** to update about page automatically
5. **Provide manual override capabilities** for special occasions or campaigns

## User Experience

### Current Workflow
1. Whitney publishes great content (podcast, presentation, etc.)
2. About page remains unchanged, missing opportunity to showcase the work
3. Visitors see outdated information about Whitney's recent activities

### New Workflow
1. Whitney publishes content and adds it to her spreadsheet
2. If it's showcase-worthy, she marks "Yes" in the new "Highlight" column
3. About page automatically updates to feature this content within an hour
4. If no recent highlights exist, page shows default professional bio plus recent content grid

## Technical Requirements

### Spreadsheet Schema Changes
- **New Column**: "Highlight" (Yes/No values)
- **Optional Column**: "Highlight_Priority" (1-10 for ranking multiple highlights)
- **Integration**: Modify existing sync system to read these new columns

### Content Selection Logic
```
IF recent_highlighted_content (≤3 months old):
    Display most recent highlight (or highest priority if tied)
ELSE:
    Display default about page with recent content grid
```

### About Page Components
**Dynamic Section**:
- Featured content title and link
- Brief description or excerpt
- Date and content type
- "Why I'm proud of this" note (optional new spreadsheet column)

**Static Section**:
- Professional bio
- Contact information
- Social links

**Fallback Section** (when no recent highlights):
- Default bio
- Grid of 3-6 most recent items across all content types
- Call-to-action to explore content pages

### Integration Points
- **Sync System**: Extend existing Google Sheets sync to process highlight columns
- **Micro.blog**: Create or update about page template with dynamic content injection
- **Content Types**: All existing content types (Podcast, Video, Blog, Present, Guest) eligible for highlighting

### Content Format
About page structure:
```markdown
# About Whitney

## Currently Highlighting
[Featured Content Title](link)
*[Content Type] - [Date]*

[Brief description or why it's highlighted]

---

## About Me
[Static professional bio]

## Recent Work
[Grid of recent content when no highlights available]

## Get in Touch
[Contact information]
```

## Implementation Approach

### Technology Integration
- **Extend existing Python/JavaScript sync system** rather than creating new infrastructure
- **Leverage GitHub Actions** scheduling for updates
- **Use micro.blog API** for about page updates
- **File-based templating** for about page generation

### Content Management
- **Highlight selection**: Pick most recent highlighted item ≤3 months old
- **Conflict resolution**: Use priority column if multiple highlights on same date
- **Content preview**: Extract first 100-200 characters for description
- **Link validation**: Ensure highlighted content links are accessible

## Success Criteria

### Functional Requirements
- [ ] Spreadsheet accepts new "Highlight" column input
- [ ] System detects highlighted content and updates about page
- [ ] Most recent highlight appears on about page within sync cycle
- [ ] About page falls back to default content when highlights are stale
- [ ] Manual override capability works for special cases
- [ ] All content types can be highlighted appropriately

### Non-Functional Requirements
- [ ] About page updates maintain same reliability as existing sync system
- [ ] Page load performance not degraded by dynamic content
- [ ] Fallback content provides meaningful value to visitors
- [ ] System gracefully handles missing or malformed highlight data

## Implementation Milestones

### Milestone 1: Spreadsheet Schema Extension
- [ ] Add "Highlight" column to Google Sheets
- [ ] Add optional "Highlight_Priority" column
- [ ] Update sync system to read new columns
- [ ] Test data parsing with new schema

**Success Criteria**: Sync system successfully reads highlight information from spreadsheet

### Milestone 2: About Page Template System
- [ ] Create dynamic about page template
- [ ] Implement content injection logic
- [ ] Design fallback content layout
- [ ] Test template rendering with sample data

**Success Criteria**: Can generate about page with both highlighted and fallback content

### Milestone 3: Highlight Selection Logic
- [ ] Implement most-recent-highlight selection algorithm
- [ ] Add 3-month freshness check
- [ ] Handle priority-based selection for ties
- [ ] Create comprehensive test cases

**Success Criteria**: System correctly identifies which content to feature

### Milestone 4: Integration with Existing Sync
- [ ] Extend sync workflow to generate about page
- [ ] Integrate with micro.blog API for page updates
- [ ] Add about page to existing error handling
- [ ] Test full end-to-end workflow

**Success Criteria**: About page updates automatically as part of regular sync cycle

### Milestone 5: Manual Override System
- [ ] Design override mechanism (special spreadsheet row or config)
- [ ] Implement temporary highlight capability
- [ ] Add expiration logic for overrides
- [ ] Test override and restore functionality

**Success Criteria**: Whitney can manually feature specific content temporarily

### Milestone 6: Testing and Deployment
- [ ] Test with various highlight scenarios (none, one, multiple)
- [ ] Validate fallback behavior
- [ ] Performance test about page generation
- [ ] Documentation for using highlight system

**Success Criteria**: System handles all edge cases gracefully and documentation is complete

## Dependencies & Risks

### External Dependencies
- **Google Sheets API**: Schema changes require proper column handling
- **Micro.blog API**: About page update capabilities and limitations
- **Existing Sync System**: Must not break current functionality

### Technical Risks
- **Schema Migration**: Adding columns might affect existing sync logic
- **Content Quality**: Highlighted content might not always be appropriate for about page
- **Performance Impact**: Dynamic page generation could slow sync process
- **API Limitations**: Micro.blog might have restrictions on about page updates

### Mitigation Strategies
- **Gradual Rollout**: Test with optional columns first, make required later
- **Content Validation**: Add checks for appropriate highlight content
- **Performance Optimization**: Cache about page content, update only when highlights change
- **API Testing**: Thoroughly test micro.blog about page update capabilities

## Definition of Done

The feature is complete when:
1. Whitney can mark any content as "Highlight: Yes" in her spreadsheet
2. The about page automatically features the most recent highlighted content within 1 hour
3. When highlighted content is >3 months old, about page shows default content with recent work grid
4. System handles edge cases (no highlights, multiple highlights, missing data) gracefully
5. About page maintains fast load times and good user experience
6. Whitney has clear documentation on how to use the highlight system

## Progress Log

### 2025-09-26
- **PRD Created**: Initial requirements gathering and documentation
- **GitHub Issue**: [#2](https://github.com/wiggitywhitney/content-manager/issues/2) created
- **Next Steps**: Discuss highlight column design with Whitney and begin Milestone 1

---

*This PRD will be updated as implementation progresses and requirements are refined.*
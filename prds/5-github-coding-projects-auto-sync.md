# PRD: GitHub-Aware Coding Projects Auto-Sync

**GitHub Issue**: TBD (create when ready to start)
**Status**: Planning (Deferred until PRD #1 complete)
**Priority**: Medium
**Created**: 2025-10-17

---

## Problem Statement

Whitney's Micro.blog site has sections for podcasts, videos, presentations, and guest appearances that are managed via spreadsheet (PRD #1). However, coding projects don't fit this model because:

- **Ongoing activity**: Projects have continuous commit activity, not discrete "publication" events
- **GitHub is source of truth**: Activity is tracked in GitHub, not manually entered in a spreadsheet
- **Spreadsheet limitations**: Adding a project once doesn't reflect ongoing commits; the entry becomes stale
- **Auto-hide mismatch**: Standard "4 months since last spreadsheet row" logic doesn't capture whether a project is still active

## Solution Overview

Build a separate automated system that:
1. Discovers public GitHub repositories owned/contributed to by Whitney
2. Detects recent activity (commits, PRs, releases) via GitHub API
3. Automatically posts/updates projects on Micro.blog Coding Projects page
4. Shows/hides the page based on actual GitHub activity (not spreadsheet rows)

**Key Difference from PRD #1**: Direct GitHub API → Micro.blog pipeline (no spreadsheet intermediary)

## User Experience

### Current State
- Coding projects are manually tracked in spreadsheet alongside other content
- No automatic detection of ongoing project activity
- Page visibility not tied to actual development work

### Desired State
1. Whitney works on public GitHub repos (as she normally does)
2. System automatically detects repos with recent activity
3. Coding Projects page on Micro.blog updates automatically
4. Page shows when projects are active, hides when no recent activity
5. No manual spreadsheet updates required

## High-Level Requirements

### GitHub Integration
- **Authentication**: GitHub personal access token or OAuth
- **Scope**: Read access to public repos and commit history
- **Discovery**: Query repos owned by Whitney or with significant contributions
- **Activity Detection**: Determine "recent activity" threshold (e.g., commits in last 60 days)

### Filtering Criteria (Open Questions)
- Repos to include: owned only? contributed to? minimum commit count?
- Exclude: test repos, forks with minimal contributions, archived repos
- Activity types: commits only, or include PRs/issues/releases?
- Minimum activity threshold to be "featured"

### Micro.blog Integration
- **Page**: `/coding-projects` (or similar)
- **Post Format**: Repo name, description, link, possibly language/tags
- **Updates**: Refresh when repo list changes or descriptions update
- **Visibility**: Page auto-shows when ≥1 active repo, auto-hides when all repos inactive

### Sync Behavior
- **New Active Repo**: Create post on Coding Projects page
- **Repo Becomes Inactive**: Remove post (or keep but mark as archived?)
- **Repo Activity Resumes**: Re-add post if previously removed
- **Description Updates**: Sync GitHub repo description changes to Micro.blog

## Technical Approach (High-Level)

### Architecture
```
GitHub API ↔ GitHub Actions Worker ↔ Micro.blog
                     ↓
            Activity Tracking State
                     ↓
          Error Notifications
```

### Technology Stack
- **Runtime**: GitHub Actions (reuse PRD #1 infrastructure)
- **Language**: JavaScript/Node.js (consistent with PRD #1)
- **APIs**: GitHub REST/GraphQL API, Micro.blog Micropub API
- **Authentication**: GitHub token (new), Micro.blog token (reuse PRD #1)

### Reusable Components from PRD #1
- ✅ Micro.blog posting infrastructure (Milestone 4-5)
- ✅ Auto-hide/show page logic (Milestone 6)
- ✅ Error handling patterns (Milestone 7)
- ✅ GitHub Actions deployment (Milestone 8)

### New Components
- 🆕 GitHub API integration
- 🆕 Repository discovery and filtering
- 🆕 Activity detection logic
- 🆕 Repo state tracking (active/inactive transitions)

## Success Criteria

- [ ] System automatically discovers Whitney's active public repos
- [ ] Coding Projects page appears on Micro.blog when repos are active
- [ ] Posts include repo name, description, and link
- [ ] Page auto-hides when no repos have recent activity (e.g., 60 days)
- [ ] Page auto-shows when repo activity resumes
- [ ] No manual intervention required
- [ ] System runs reliably on automated schedule

## Open Questions (To Resolve During Planning)

### Repository Selection
- Which repos to feature? (owned only, contributed to, starred?)
- Minimum contribution threshold for non-owned repos?
- How to handle forks?
- Exclude private repos that become public?

### Activity Definition
- What counts as "activity"? (commits, PRs, issues, releases, stars?)
- Activity time window? (30/60/90 days?)
- Different thresholds for owned vs contributed repos?

### Content & Presentation
- Post format on Micro.blog?
- Include repo stats? (stars, forks, language, last commit date?)
- Group by language/topic or flat list?
- Archive old projects or remove completely?

### Technical Details
- GitHub API rate limits and quotas?
- GraphQL vs REST API?
- How often to check for updates?
- State management for repo lifecycle tracking?

## Dependencies

### Hard Dependencies
- **PRD #1 Complete**: Requires Micro.blog infrastructure and patterns established
- **GitHub API Access**: Personal access token or GitHub App
- **Micro.blog API**: Same as PRD #1

### Risks
- **GitHub API Rate Limits**: May need careful query optimization
- **Repository Churn**: Many repos might create/hide page frequently
- **Definition Ambiguity**: "Active project" can be subjective without clear filtering
- **Maintenance Overhead**: Another data source to monitor and maintain

## Implementation Phasing

**Phase 1 (After PRD #1)**: Design and planning
- Resolve open questions
- Define filtering criteria and activity thresholds
- Design GitHub API integration approach
- Break into detailed milestones

**Phase 2**: Implementation
- GitHub API integration
- Repository discovery and filtering
- Activity detection logic
- Micro.blog posting integration

**Phase 3**: Refinement
- Tune activity thresholds based on real data
- Optimize for API rate limits
- Add filtering or curation capabilities if needed

## Timeline

**Start**: After PRD #1 Milestones 1-8 are complete and stable
**Estimated Duration**: TBD during planning phase
**Priority**: Medium (nice-to-have, not blocking other work)

## Notes

- This PRD is intentionally high-level; details will be fleshed out when ready to start
- Focus first on getting PRD #1 working end-to-end
- GitHub activity patterns will inform better design decisions (wait for real data)
- May discover GitHub provides better/worse API than expected during implementation

---

## Progress Log

### 2025-10-17: PRD Created
- Created skeleton PRD to capture concept
- Identified as separate data pipeline from spreadsheet-based content (PRD #1)
- Noted reusable components from PRD #1
- Captured open questions for future planning
- Status: Deferred until PRD #1 complete

---

*This PRD is a placeholder to capture the concept. It will be expanded with detailed requirements and implementation plan when PRD #1 is complete.*

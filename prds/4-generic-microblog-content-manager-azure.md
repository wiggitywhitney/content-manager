# PRD: Generic Micro.blog Content Manager with Azure

**GitHub Issue**: [#4](https://github.com/wiggitywhitney/content-manager/issues/4)
**Status**: Planning
**Priority**: Medium
**Created**: 2025-10-17

---

## Problem Statement

The content-manager repository demonstrates a valuable workflow pattern: managing Micro.blog content through a spreadsheet interface. However, this solution is currently specific to one user's setup and lacks documentation for others to replicate or adapt it. Additionally, there's an opportunity to showcase this pattern on Azure infrastructure as both a learning tool and a reference implementation for the Microsoft/Azure community.

## Solution Overview

Create a **generic, reusable Micro.blog Content Manager** that any Micro.blog user can deploy to manage their content via spreadsheet. This will be delivered as three interconnected pieces:

1. **Working Application**: Hosted on Azure, demonstrating the complete workflow
2. **Comprehensive Tutorial**: Step-by-step guide for deploying your own instance
3. **Blog Post**: Narrative piece covering the learnings, architecture decisions, and Azure insights

This positions the project as both a useful tool AND educational content for Microsoft MVPs, Azure learners, and the Micro.blog community.

## Success Criteria

- [ ] Any Micro.blog user can deploy their own instance following the tutorial
- [ ] Application successfully deployed to Azure using free tier/credits where possible
- [ ] Tutorial published and tested by at least one external user
- [ ] Blog post published showcasing Azure learnings and architecture
- [ ] Code is open source and reusable (new repository)

## Target Users

**Primary**:
- Micro.blog users who want spreadsheet-based content management
- Microsoft MVPs exploring Azure capabilities
- Developers learning cloud deployment patterns

**Secondary**:
- Content creators looking for batch publishing workflows
- Azure learners seeking real-world examples

## Open Questions for Later Consideration

### 1. Target Audience Prioritization
- Is this primarily for other Microsoft MVPs/Azure learners?
- For Micro.blog users who want spreadsheet management?
- For developers learning cloud deployment patterns?
- **Decision needed**: Which audience should drive UX/documentation decisions?

### 2. Spreadsheet Platform Strategy
- Excel Online is free to view/edit with Microsoft account
- Desktop Excel requires Office 365/purchase
- Google Sheets has broader free access
- **Decision needed**: Support Excel only (Microsoft ecosystem alignment) or both Excel and Google Sheets (broader reach)?

### 3. "Generic" Scope Definition
- Minimal: User provides Micro.blog credentials, uses pre-made spreadsheet template
- Moderate: Include configuration wizard/onboarding flow
- Advanced: Support multiple content types, custom field mapping
- **Decision needed**: What level of genericization provides best value/effort ratio?

### 4. Azure Services Selection
- Which Azure services to showcase? (Functions, Static Web Apps, Container Apps, etc.)
- Serverless vs containerized approach?
- Cost optimization strategy (important even with free credits)
- **Decision needed**: Which services best demonstrate learning objectives?

### 5. Deliverable Priority
- Is the blog post/tutorial the MAIN deliverable (app is supporting material)?
- Or is the working app the main thing (tutorial documents replication)?
- **Decision needed**: This affects scope and polish level for each component

### 6. Timeline and Learning Approach
- Project is "weeks from now" - suggests learning-as-you-go
- Should PRD account for exploration/experimentation phases?
- **Decision needed**: Fixed milestones vs flexible discovery approach?

## High-Level Architecture (Preliminary)

### Core Components
1. **Spreadsheet Interface**: Excel/Google Sheets as content database
2. **Azure Backend**: Processing and API layer (service TBD)
3. **Micro.blog Integration**: Publishing to Micro.blog API
4. **Authentication**: User credential management
5. **Deployment Pipeline**: Automated setup process

### Key Learnings from Current content-manager
- Spreadsheet as database pattern works well
- Batch operations are valuable for content creators
- Need clear content state tracking (published/draft/scheduled)

## Deliverables

### 1. Working Application (New Repository)
- Clean, generic codebase
- Deployed to Azure
- Configuration-driven (supports any Micro.blog account)
- README with setup instructions

### 2. Comprehensive Tutorial
- Prerequisites and setup
- Step-by-step Azure deployment
- Configuration walkthrough
- Troubleshooting guide
- Could be in repo docs or separate blog series

### 3. Blog Post
- Narrative of the learning journey
- Architecture decisions and tradeoffs
- Azure-specific insights (cost, services, patterns)
- Micro.blog integration learnings
- Reusable patterns for similar projects

## Major Milestones

- [ ] **Architecture Design Complete**: Azure services selected, architecture documented, open questions answered
- [ ] **Core Generic App Working Locally**: Configurable version of content manager runs on development machine
- [ ] **Azure Deployment Successful**: App deployed and running on Azure infrastructure
- [ ] **Tutorial Documentation Complete**: Step-by-step guide tested and validated
- [ ] **Blog Post Published**: Learning narrative written and published
- [ ] **New Repository Created**: Code published in dedicated generic repo with full documentation

## Technical Considerations

### Azure Learning Objectives
- Practical experience with chosen Azure services
- Cost management and optimization
- Deployment automation
- Production-ready patterns for MVPs to reference

### Reusability Requirements
- Configuration over code changes
- Clear documentation
- Minimal prerequisites
- Easy local development setup

### Microsoft Ecosystem Alignment
- Leverages Azure (MVP credits!)
- Potentially Excel-focused (Microsoft tooling)
- Reference implementation for Microsoft community

## Dependencies

- **Current content-manager**: Serves as proof-of-concept and learning base
- **Azure credits**: Available for deployment and experimentation
- **Micro.blog API**: Must remain stable and accessible
- **New repository**: Will be created during implementation phase

## Timeline

**Phase**: Exploratory/Planning (current)
**Expected Start**: Weeks from now (after current MVP is established)
**Approach**: Iterative learning-based development

*Detailed timeline will be established when implementation begins*

## Risk Assessment

### Technical Risks
- Azure service selection may need iteration based on learnings
- Cost overruns even with free credits (mitigation: monitor spending, use free tiers)
- Spreadsheet API limitations across platforms

### Scope Risks
- "Generic" could expand infinitely (mitigation: define MVP scope clearly before starting)
- Tutorial maintenance as Azure services evolve
- Supporting multiple spreadsheet platforms increases complexity

### Success Risks
- Unclear target audience could result in unfocused deliverable
- Tutorial may be too specific or too general
- Blog post timing relative to Azure service changes

## Notes

- This PRD started in content-manager repo but will reference new dedicated repository
- High-level planning phase - implementation details to be determined
- Focus on learning and community value, not just working code
- Microsoft MVP context provides both credibility and audience for blog post

## Progress Log

### 2025-10-17: PRD Created
- Initial concept discussion
- Option B selected (generic app vs migration)
- Open questions captured for later consideration
- GitHub issue #4 created
- Awaiting deeper planning phase before implementation starts

---

## Next Steps

When ready to begin implementation (weeks from now):
1. Answer open questions (audience, spreadsheet platform, Azure services)
2. Create new dedicated repository
3. Design detailed architecture
4. Break down milestones into specific implementation tasks
5. Begin iterative development with learning objectives in mind

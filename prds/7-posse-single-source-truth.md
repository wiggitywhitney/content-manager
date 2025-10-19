# PRD: POSSE - Single Source of Truth Publishing

**Issue**: [#7](https://github.com/wiggitywhitney/content-manager/issues/7)
**Status**: Planning
**Priority**: High
**Created**: 2025-10-19
**Last Updated**: 2025-10-19

## Problem Statement

Currently managing multiple separate social media accounts (Mastodon @wiggitywhitney@hachyderm.io, Bluesky @wiggitywhitney.bsky.social) with cross-posting from Micro.blog. This approach creates:

- **Fragmented identity**: Separate handles on different platforms instead of unified domain-based identity
- **Duplicated content management**: Multiple accounts to maintain, update, and monitor
- **Platform dependency**: Identity tied to platform hostnames rather than owned domain
- **Limited portability**: Cannot easily migrate followers if platforms change
- **Cross-posting overhead**: Managing which platforms receive which content

## Solution Overview

Implement true POSSE (Publish Own Site, Syndicate Elsewhere) using Micro.blog as single source of truth:

1. **Native Fediverse Integration**: Use Micro.blog's native ActivityPub support for Mastodon/fediverse presence (not cross-posting)
2. **Domain-Based Identity**: Migrate to domain-based handles on both platforms (exact format TBD at implementation)
3. **Strategic Cross-Posting**: Configure cross-posting to platforms without native federation (Bluesky, Flickr, LinkedIn, others)
4. **Single Publishing Point**: All content originates at whitneylee.com, distributed automatically
5. **Account Migration**: Transition followers from legacy accounts to new domain-based identity

**IMPORTANT**: All implementation details, migration strategies, and platform decisions will be confirmed at implementation time. This PRD captures the vision and planning.

## User Experience

### Current Workflow
1. Whitney posts content to Micro.blog (whitneylee.com)
2. Micro.blog **cross-posts** copies to Mastodon and Bluesky
3. Whitney maintains separate accounts: `@wiggitywhitney@hachyderm.io` and `@wiggitywhitney.bsky.social`
4. Followers on each platform follow platform-specific accounts
5. Conversations happen on multiple platforms independently

### New Workflow (POSSE)
1. Whitney posts content to Micro.blog (whitneylee.com)
2. **Fediverse (Mastodon)**: Content appears natively via ActivityPub with domain-based handle (federation, not copy)
3. **Bluesky**: Content cross-posts with domain-based handle `@whitneylee.com` (AT Protocol incompatible, still requires copying)
4. **Other Platforms**: Content cross-posts to Flickr, LinkedIn, and any other configured platforms
5. All identity tied to whitneylee.com domain (portable, owned)
6. Followers migrate to new domain-based handles

## Technical Requirements

### Native Fediverse Integration

**Current State**:
- Micro.blog has native ActivityPub support
- Currently configured for cross-posting to Mastodon (copying content)
- Existing Hachyderm account: `@wiggitywhitney@hachyderm.io`

**Target State**:
- Disable Mastodon cross-posting (turn off copy mechanism)
- Enable native fediverse presence via ActivityPub
- New fediverse handle: Domain-based format TBD at implementation
  - Possibilities: `@whitneylee.com`, `@whitney@whitneylee.com`, or other format
  - Research Micro.blog's fediverse handle format during Milestone 1
- Mastodon users can follow and interact natively (replies, boosts, favorites)
- Content federated, not copied

**Open Questions** (Research at Implementation Time):
- What fediverse handle formats does Micro.blog support?
- Can Hachyderm handle also be `@whitneylee.com` or must it be `@username@domain` format?
- How to verify native fediverse is working correctly?
- Can Mastodon followers migrate from Hachyderm to new domain?
- Do we still want to do this migration?

### Bluesky Handle Migration

**Current State**:
- Bluesky account: `@wiggitywhitney.bsky.social`
- Micro.blog configured for cross-posting to Bluesky
- Bluesky uses AT Protocol (incompatible with ActivityPub)

**Target State**:
- Change Bluesky handle to `@whitneylee.com` (domain verification via DNS or HTTPS)
- Continue cross-posting from Micro.blog (AT Protocol requires copying, not federation)
- Account content and followers remain intact

**Implementation Steps** (Confirm at Implementation Time):
1. Verify domain ownership in Bluesky settings (DNS TXT record or HTTPS file)
2. Change handle from `@wiggitywhitney.bsky.social` to `@whitneylee.com`
3. Verify cross-posting still works correctly
4. Test that existing followers see updated handle

### Cross-Posting Platform Configuration

**Current State**:
- Cross-posting enabled: Mastodon, Bluesky
- Not configured: Flickr, LinkedIn, others

**Target State**:
- Disable: Mastodon cross-posting (replaced by native fediverse)
- Enable: Bluesky (handle updated), Flickr, LinkedIn
- Configure: Any other platforms where Whitney has accounts
- Selective cross-posting: Ability to control which content goes to which platforms (if supported by Micro.blog)

**Platform Research Needed** (Implementation Time):
- Does Micro.blog support native Flickr cross-posting? Or custom integration required?
- Does Micro.blog support native LinkedIn cross-posting? Or custom integration required?
- What other platforms does Whitney want to syndicate to?
- Can cross-posting be controlled per-post or per-category?

### Account Migration Strategy

**All Decisions Deferred to Implementation Time**

**Hachyderm (Mastodon) Account**:
- Options:
  - **Option A**: Keep both accounts temporarily, post announcement encouraging migration
  - **Option B**: Use Mastodon's account migration feature to redirect followers
  - **Option C**: Close Hachyderm account immediately after migration
- Migration communication plan: TBD during implementation

**Bluesky Account**:
- Options:
  - **Option A**: Handle change is transparent - existing followers see new handle automatically
  - **Option B**: Post announcement about handle change for clarity
  - **Option C**: Keep both handles if Bluesky allows (unlikely)
- Verification that followers migrate with handle change

## Content Strategy

### What Content Syndicates Where?

**All Content** (default):
- ✅ whitneylee.com (Micro.blog) - always
- ✅ Fediverse (native ActivityPub) - always
- ✅ Bluesky (cross-post) - always

**Selective Syndication** (TBD based on Micro.blog capabilities):
- Should video content cross-post to all platforms?
- Should blog posts cross-post differently than podcasts?
- Does LinkedIn want different content than Bluesky?
- Can this be controlled per-post or per-category?

### Historical Content

**From PRD-6** (Historical Content Integration):
- PRD-6 imports bulk historical content with cross-posting **disabled**
- Historical content will NOT federate or cross-post initially
- **Decision needed at implementation**: Should historical content federate after POSSE setup?
  - **Option A**: Historical content remains on whitneylee.com only (cleaner timelines)
  - **Option B**: Enable federation/cross-posting for historical content (complete archive everywhere)
  - **Recommendation**: Option A (avoid timeline spam with old content)

## Success Criteria

### Functional Requirements
- [ ] Native fediverse presence working (Mastodon users can follow domain-based handle)
- [ ] Bluesky handle changed to `@whitneylee.com`
- [ ] Bluesky cross-posting working with new handle
- [ ] Flickr cross-posting enabled and working
- [ ] LinkedIn cross-posting enabled and working
- [ ] All other identified platforms configured
- [ ] Legacy account migration strategy documented and executed

### Non-Functional Requirements
- [ ] Identity tied to owned domain (whitneylee.com), not platform
- [ ] Followers can discover and migrate to new handles
- [ ] Content appears correctly on all platforms
- [ ] No duplicate posts or timeline spam
- [ ] Single publishing point (Micro.blog) maintains all platforms

## Implementation Milestones

### Milestone 1: Research & Documentation
**Estimated Time**: ~2-3 hours

- [ ] Confirm we still want to implement POSSE at this time
- [ ] Research Micro.blog's native fediverse implementation
  - What fediverse handle formats are supported?
  - Can handle be just `@whitneylee.com` or must it be `@username@whitneylee.com`?
  - How to enable/disable native ActivityPub vs cross-posting?
  - What's the difference in Micro.blog settings?
- [ ] Research Bluesky handle change process
  - DNS TXT record or HTTPS file verification?
  - Does handle change preserve followers?
  - Can handle be changed back if needed?
- [ ] Research Micro.blog cross-posting capabilities
  - Does Flickr integration exist natively?
  - Does LinkedIn integration exist natively?
  - What other platforms are supported?
  - Can cross-posting be controlled per-post or per-category?
- [ ] Document current cross-posting configuration
  - Screenshot current Micro.blog settings
  - List all currently enabled cross-posting destinations
  - Document credentials/tokens for each platform
- [ ] Create implementation plan based on research findings

**Success Criteria**: Research documented, implementation plan clear, all questions answered, confirmed we want to proceed

### Milestone 2: Native Fediverse Setup
**Estimated Time**: ~1-2 hours

- [ ] Identify current Micro.blog fediverse configuration
  - Is native ActivityPub already enabled?
  - What is the current fediverse handle?
- [ ] Disable Mastodon cross-posting (turn off copy mechanism)
- [ ] Verify native fediverse presence is active
  - Test following from Mastodon account
  - Test replies, boosts, favorites work correctly
- [ ] Document new fediverse handle (actual format discovered)
- [ ] Test content appears correctly in fediverse timelines
- [ ] Verify no duplicate posts (native + cross-post conflict)

**Success Criteria**: Native fediverse working, Mastodon cross-posting disabled, handle documented

### Milestone 3: Bluesky Handle Migration
**Estimated Time**: ~1-2 hours

- [ ] Set up domain verification for Bluesky
  - Choose verification method (DNS TXT or HTTPS file)
  - Implement verification (add DNS record or create HTTPS file)
- [ ] Change Bluesky handle from `@wiggitywhitney.bsky.social` to `@whitneylee.com`
- [ ] Verify existing followers still see account
- [ ] Verify Micro.blog cross-posting still works with new handle
- [ ] Test new post appears on Bluesky with new handle
- [ ] Document handle change process for future reference

**Success Criteria**: Bluesky handle changed, cross-posting working, followers intact

### Milestone 4: Additional Platform Cross-Posting
**Estimated Time**: ~2-4 hours (varies by platform count and complexity)

- [ ] Enable Flickr cross-posting
  - Research integration method (native Micro.blog or custom)
  - Configure credentials/tokens if needed
  - Test cross-posting with sample post
  - Verify content format appropriate for Flickr
- [ ] Enable LinkedIn cross-posting
  - Research integration method (native Micro.blog or custom)
  - Configure credentials/tokens if needed
  - Test cross-posting with sample post
  - Verify content format appropriate for LinkedIn
- [ ] Identify any other platforms to enable
- [ ] Configure additional platforms as needed
- [ ] Test selective cross-posting if supported
- [ ] Document all platform configurations

**Success Criteria**: All identified platforms configured and tested

### Milestone 5: Account Migration Communication
**Estimated Time**: ~2-3 hours

- [ ] Decide on Hachyderm account strategy (keep, migrate, close)
- [ ] Decide on Bluesky account strategy (announce handle change)
- [ ] Draft migration announcement(s)
  - Explain new domain-based identity
  - Provide new handles to follow
  - Explain benefits (portable, owned domain)
- [ ] Post announcements to legacy accounts if keeping temporarily
- [ ] Execute Mastodon account migration if using built-in feature
- [ ] Monitor migration progress (follower counts, engagement)
- [ ] Update bio/profiles on all platforms with new handles

**Success Criteria**: Migration communication complete, followers informed, strategy executed

### Milestone 6: Testing & Validation
**Estimated Time**: ~1-2 hours

- [ ] Test end-to-end publishing flow
  - Create test post on Micro.blog
  - Verify appears natively on fediverse (not copied)
  - Verify cross-posts to Bluesky with correct handle
  - Verify cross-posts to Flickr, LinkedIn, and other platforms
- [ ] Test different content types (text, images, videos if applicable)
- [ ] Verify no duplicate posts or cross-posting conflicts
- [ ] Test replies, engagement on each platform
- [ ] Verify content format appropriate for each platform
- [ ] Check historical content behavior (confirm not federating if Option A chosen)
- [ ] Document any issues or limitations discovered

**Success Criteria**: All platforms working correctly, POSSE fully operational

## Dependencies & Risks

### External Dependencies
- **Micro.blog Platform**: Native fediverse and cross-posting capabilities
- **Bluesky Platform**: Handle change process and domain verification
- **Third-Party Platforms**: Flickr, LinkedIn, others - integration requirements
- **Domain Control**: DNS access for Bluesky domain verification
- **ActivityPub Protocol**: Fediverse interoperability

### Technical Risks
- **Follower Migration**: Followers may not discover or migrate to new handles
- **Cross-Posting Conflicts**: Native fediverse + cross-posting might create duplicates
- **Platform Limitations**: Some platforms might not support required integrations
- **Handle Change Issues**: Bluesky handle change might not preserve all account data
- **Historical Content**: Enabling federation on old content might spam timelines

### Mitigation Strategies
- **Follower Migration**: Clear communication, gradual transition, keep legacy accounts temporarily if needed
- **Duplicate Prevention**: Careful configuration, thorough testing before full deployment
- **Platform Research**: Complete Milestone 1 research before committing to specific platforms
- **Backup Plan**: Document how to rollback changes if critical issues arise
- **Historical Content**: Default to NOT federating old content (PRD-6 imports with cross-posting disabled)

## Definition of Done

The feature is complete when:
1. Whitney posts to Micro.blog and content appears natively on fediverse (no cross-posting copy)
2. Fediverse users can follow domain-based handle (format discovered during implementation)
3. Bluesky handle is `@whitneylee.com` and cross-posting works correctly
4. Flickr, LinkedIn, and all other identified platforms receive cross-posted content
5. Legacy accounts migrated or closed per chosen strategy
6. Followers informed and able to find new domain-based identity
7. All integrations tested and working without duplicates or errors
8. Identity fully tied to owned domain (whitneylee.com), not platforms

## Dependency Chain

```
PRD-1 (Automated Content Publishing) - In Progress, Milestone 5
  ↓
PRD-6 (Historical Content Integration) - Ready to start (cross-posting disabled)
  ↓
PRD-7 (POSSE - This PRD) - After PRD-6 complete
  ↓
PRD-8 (Rate-Limited Publishing) - After POSSE complete
```

**Rationale**:
- PRD-6 requires cross-posting disabled (currently OFF) to bulk import historical content safely
- POSSE PRD sets up proper architecture for native fediverse + strategic cross-posting
- Rate limiting PRD enables updating spreadsheet with recent content safely after POSSE configured

## Design Decisions

### Decision 1: Native Fediverse for Mastodon, Cross-Posting for Bluesky
**Date**: 2025-10-19
**Status**: ✅ Confirmed

**Rationale**:
- Mastodon and Micro.blog both use ActivityPub - native federation possible
- Bluesky uses AT Protocol (incompatible with ActivityPub) - requires cross-posting
- Native federation is superior: true interaction, no copies, decentralized identity
- Cross-posting acceptable for incompatible protocols (Bluesky, LinkedIn, Flickr)

**Impact**:
- Milestone 2 focuses on native fediverse (disable cross-posting, enable federation)
- Milestone 3 focuses on Bluesky cross-posting (handle change, continue copying)
- Architecture split: federation where possible, cross-posting where necessary

### Decision 2: Domain-Based Identity Research Required
**Date**: 2025-10-19
**Status**: 🔍 Research at Implementation Time

**Rationale**:
- Both fediverse and Bluesky support domain-based handles
- Exact format varies by platform and implementation
- Fediverse options: `@whitneylee.com` or `@username@whitneylee.com` or other
- Bluesky format: `@whitneylee.com` (AT Protocol domain verification)
- Must research Micro.blog's specific fediverse implementation
- Handle format confirmation required before migration

**Impact**:
- Milestone 1 research includes determining exact handle formats
- Cannot finalize migration communication until formats known
- Flexibility to choose best handle format based on options available

### Decision 3: All Migration Strategies Confirmed at Implementation Time
**Date**: 2025-10-19
**Status**: 🔍 Defer to Implementation

**Rationale**:
- Account migration is high-risk (follower loss, platform dependencies)
- Micro.blog capabilities may change between PRD creation and implementation
- User preferences may change (keep vs close legacy accounts)
- Better to research thoroughly and decide when ready to execute

**Impact**:
- Milestone 1 includes confirmation that we still want POSSE migration
- Milestone 5 includes all account migration decision-making
- PRD captures options and considerations, not final decisions

### Decision 4: Historical Content Does Not Federate
**Date**: 2025-10-19
**Status**: ✅ Recommended (Final decision at implementation)

**Rationale**:
- PRD-6 imports bulk historical content with cross-posting disabled
- Enabling federation retroactively would flood followers' timelines with old posts
- Historical content valuable on whitneylee.com, but disruptive if syndicated
- Current followers didn't sign up for archive of old content

**Recommendation**: Leave historical content on whitneylee.com only, do not enable federation/cross-posting

**Alternative**: If user wants complete archive everywhere, enable federation after import (accept timeline spam risk)

**Impact**: Milestone 6 testing includes verifying historical content behavior matches chosen option

## Progress Log

### 2025-10-19 (PRD Creation)
- **PRD Created**: POSSE requirements gathered and documented
- **GitHub Issue**: [#7](https://github.com/wiggitywhitney/content-manager/issues/7) created
- **Key Decisions**: Native fediverse vs cross-posting split, domain-based identity research required, all migration strategies deferred
- **Research Areas Identified**: Micro.blog fediverse handle formats, Bluesky handle change, platform cross-posting options
- **Dependencies Documented**: PRD-1 → PRD-6 → PRD-7 (this PRD) → PRD-8
- **Flexibility Noted**: All implementation details, handle formats, and migration strategies to be confirmed at implementation time

---

*This PRD will be updated as implementation progresses and requirements are refined.*

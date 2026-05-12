# PRD: Fix Dispatch Priority — Three-Tier Fallback, One Post Per Day

**Issue**: [#56](https://github.com/wiggitywhitney/content-manager/issues/56)
**Status**: Not Started
**Priority**: High
**Created**: 2026-05-12
**Last Updated**: 2026-05-12

## Problem Statement

The daily dispatch logic allows more than one post to go out in a single run, and the micro.blog-only gate is gated on a condition that is too strict to be useful in practice.

**Two-posts-in-one-day bug**: On May 12, 2026 the career sync step ran (because the social queue had no non-micro.blog pending posts) and posted career content, AND the social dispatch step also ran and posted the micro.blog-only Jana Werner episode row. Two posts went out.

The root cause: on even (social-priority) days `CAREER_PRIORITY=0` so `careerFirst=false`. The guard `if (careerFirst && checkCareerPostedToday())` short-circuits to false, and the social dispatch step does not check whether career already posted before proceeding to the micro.blog-only tier.

**Micro.blog-only gate too strict**: The micro.blog-only tier is gated on `checkAllCareerPostsPublished()`, which checks whether every row in the live production spreadsheet has a micro.blog URL — i.e., the entire historical career backlog is clear. This condition is so strict it blocked micro.blog-only posts for weeks, then allowed one to fire on the same day as a career post.

## Solution Overview

Enforce one post per day with a three-tier fallback:

- **Social day** (even calendar day): post social → if social queue empty, post career → if both empty, post micro.blog-only
- **Career day** (odd calendar day): post career → if career posts nothing, post social → if both empty, post micro.blog-only

The fix is targeted: replace `checkAllCareerPostsPublished()` in the micro.blog-only gate with `checkCareerPostedToday()`. This ensures micro.blog-only fires only when nothing from either the social or career queue was posted today, regardless of historical backlog state.

The career-day vice-versa behavior (career posts nothing → social falls through) is already implemented via the existing `careerFirst && checkCareerPostedToday()` guard. No change is needed there.

## Dispatch Logic After This Fix

```text
processPostsForDate(today):
  1. if careerFirst AND career posted today → return (career covered the day)
  2. try fetchOldestPendingGroup() → if found, dispatch and return
  3. if checkCareerPostedToday() → return (career covered the day, micro.blog would be 2nd post)
  4. try fetchOldestPendingMicroblogPost() → if found, dispatch
```

Step 3 is the key addition. It prevents micro.blog-only from firing on any day career already posted, regardless of `CAREER_PRIORITY`.

## What Does NOT Change

- The workflow `daily-sync.yml` step conditions do not need to change. Career sync already only runs on career-priority days OR when social queue is empty.
- The `careerFirst && checkCareerPostedToday()` guard at the top of `processPostsForDate` does not change.
- The `fetchOldestPendingGroup` and `fetchOldestPendingMicroblogPost` functions do not change.
- Micro.blog cross-posting to LinkedIn/Bluesky/Mastodon is an accepted eventual duplicate. The fix reduces same-day and next-day duplication but does not eliminate the eventual duplicate — this is a deliberate trade-off documented in the conversation that produced this PRD.

## Milestones

- [ ] M1: Fix micro.blog-only gate — in `processPostsForDate` in `src/post-social-content.js`, replace the `checkAllCareerPostsPublished()` gate with `if (await checkCareerPostedToday()) { log and return; }`. `checkCareerPostedToday` is already destructured in the existing `require('./career-post-guard')` import at the top of the file — do NOT add a duplicate import, only remove `checkAllCareerPostsPublished` from that destructuring. Update the deferred log message to read `[social] No social posts pending and career posted today — micro.blog deferred`. Do NOT remove `checkAllCareerPostsPublished` from `src/career-post-guard.js` itself — another PRD may use it.
- [ ] M2: Tests updated and passing — update `tests/post-social-content.test.js` to cover all five cases of the new three-tier logic: (a) social day, social queue has pending → social dispatches, micro.blog not reached; (b) social day, social empty, career posted today → micro.blog deferred; (c) social day, social empty, career NOT posted today → micro.blog fires; (d) career day, career posted → social and micro.blog both skipped; (e) career day, career not posted, social empty → micro.blog fires. Existing tests that mock `checkAllCareerPostsPublished` must be updated to mock `checkCareerPostedToday` instead.
- [ ] M3: CLAUDE.md updated — in `content-manager/.claude/CLAUDE.md`, rewrite the `**Priority**` and `**Implementation**` paragraphs (the two prose paragraphs that follow the Post Type Taxonomy table) to describe the three-tier fallback: (1) priority-type post, (2) if none, fallback to the other type, (3) if both empty, micro.blog-only post. Remove the sentence beginning "The social step receives `CAREER_PRIORITY=0`..." — it describes internal mechanics that are now inaccurate after M1. Do not change the table rows or any other section.

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Use `checkCareerPostedToday()` not `checkAllCareerPostsPublished()` as micro.blog gate | `checkCareerPostedToday()` | Historical backlog check is too strict — blocks micro.blog-only posts indefinitely when backlog grows. Daily-empty check matches the intended "lowest priority slot" behavior. |
| Accept eventual Bluesky duplicate from micro.blog cross-post | Accept | The gap between a direct Bluesky post and the eventual micro.blog cross-post is proportional to queue depth — likely weeks to months. Not worth a complex deduplication mechanism. |
| Do not change `daily-sync.yml` | No change | The workflow step conditions are already correct. Career sync runs only when it should. The fix only needs to happen inside `post-social-content.js`. |
| Do not remove `checkAllCareerPostsPublished` from `career-post-guard.js` | Keep in guard module | Function may be useful for diagnostics or future PRDs. Remove only the usage in `post-social-content.js`. |

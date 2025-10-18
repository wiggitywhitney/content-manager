# Workflow Experiment: Branch + PR per Milestone

**Experiment**: Test milestone-per-branch with CodeRabbit review
**Test Case**: Milestone 3 (Error Handling & Logging, ~1 hour)

## Predicted Pros
- CodeRabbit might catch real issues
- Experience realistic dev workflow
- Clean separation of milestones in history
- Good practice for PR descriptions

## Predicted Cons
- Context switching kills flow
- 1 hour of work = small PR, possibly noisy review
- Overhead feels unnecessary for solo work
- Merge friction between milestones

## Actual Experience

**Time spent**:
- Coding: ~45 minutes (4 implementation steps)
- PR overhead: ~5 minutes (branch, commit, push, PR creation)
- Total: ~50 minutes
- **Overhead ratio**: 10% (very reasonable)

**CodeRabbit findings** (2 actionable, 10 nitpicks):

**Real Issues** (3):
1. ✅ **LOG_LEVEL bypass bug** - console.log in pretty summary ignores log level filtering
2. ✅ **WARN/ERROR to stderr** - standard practice for better CI tooling integration
3. ✅ **Script not importable** - process.exit() makes testing hard, needs `require.main` guard

**Nice Improvements** (3):
4. Respect Retry-After header + add jitter to backoff
5. Normalize LOG_FORMAT input (accept "JSON" and "json")
6. Broaden error classification (treat 500/503/504 as retryable network errors)

**Documentation** (4):
7. Fill in this experiment doc (doing now)
8. Markdownlint blank line in blockquote
9. Update PRD checkboxes for completed Milestone 3
10. Remove duplicate content type mapping table

**Signal-to-noise**: 3 real bugs + 3 good improvements = **6/10 valuable** (60%)

**How it felt**:
- PR process was quick and painless (5 min)
- CodeRabbit caught actual bugs I missed (LOG_LEVEL bypass is a real issue)
- Review came back in ~5 minutes
- Improvements (jitter, Retry-After) are nice but not critical
- Did NOT kill coding flow - work was complete before PR

## Decision

Continue? **Yes with Adjust**

Why:
- **60% hit rate is valuable** - CodeRabbit caught real bugs (LOG_LEVEL bypass, stderr routing)
- **Low overhead** - 10% time cost is negligible
- **Educational** - Learning what automated review catches
- **Adjust**: Group related milestones (2-3 together) to get ~2-3 hours per PR instead of 1 hour
  - Milestone 4+5 together (Micro.blog integration + CRUD)
  - Milestone 6+7 together (page visibility + notifications)

This gives CodeRabbit more code to review (better signal) while maintaining reasonable PR size.

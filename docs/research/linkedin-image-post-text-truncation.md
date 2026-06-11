# Research: LinkedIn Image Post Text Truncation

**Project:** content-manager
**Last Updated:** 2026-05-01

## Update Log
| Date | Summary |
|------|---------|
| 2026-05-01 | Initial research — root cause identified as unescaped `little` text format reserved characters |

## Findings

### Summary

The text truncation in LinkedIn image posts is **not caused by `content.media` or the image attachment format**. It is caused by **unescaped reserved characters** in the `commentary` field's `little` text format. When LinkedIn's text parser encounters an unescaped parenthesis, bracket, backslash, or other reserved character anywhere in the commentary, it **silently drops everything from that character onwards** — no error is returned, the post succeeds with 201, and the API echoes back the full text if you GET the post, but the rendered post shows only the truncated portion.

### Root Cause: `little` Text Format Reserved Characters

The `commentary` field uses LinkedIn's `little` text format for mentions and hashtags. This format has **13 reserved characters that must be backslash-escaped** before sending:

```text
( )  [ ]  { }  @  #  *  _  ~  <  >  \
```

**Source says:** "When a left or right parenthesis appears anywhere in the commentary, all text from that parenthesis onwards gets silently dropped from the post (no error returned)." ([Microsoft Learn Q&A](https://learn.microsoft.com/en-us/answers/questions/5741122/issues-when-mentioning-urns-with-special-character))

**Interpretation:** The LinkedIn parser treats `(` as the start of a `MentionElement` (`@[Name](URN)` syntax). Anything after an unmatched `(` is consumed as part of an incomplete element and silently discarded. This affects ALL post types — text-only, image posts, video posts — not just posts with media.

Social post text commonly contains parentheses (e.g., `(from the SDI podcast)`, `(link in bio)`, date ranges). If the first parenthesis appears after the first sentence, that sentence is all that gets displayed.

### Escaping Requirements

All 13 characters require a single backslash escape in the JSON string value:

```javascript
function escapeLinkedInCommentary(text) {
  // Escape all little text format reserved characters
  return text.replace(/[()[\]{}\@#*_~<>\\]/g, '\\$&');
}
```

**Important edge case:** Backslash itself requires special handling. In JSON a `\` is encoded as `\\`, but `little` format also requires the backslash to be escaped, so a literal `\` in the source text must become `\\\\` in the JSON body (four backslashes). In JavaScript string terms: `'\\\\'.replace(...)`.

**Source says:** "Special characters need to be escaped in the JSON body, including those in mention names and URNs. Required escaping: `_ | ( ) [ ] { } @ # * ~ < > \`" ([Microsoft Learn Q&A](https://learn.microsoft.com/en-us/answers/questions/5741122/issues-when-mentioning-urns-with-special-character))

**Source says** (official `little` text format docs): "Characters reserved for little elements must be escaped to be treated as plaintext." ([LinkedIn little Text Format](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format))

### Does `content.media` Cause Truncation?

No. The official Post API Schema documents no character limit difference between `content.media` posts and text-only posts. The `commentary` field description is identical across all post types:

**Source says:** "commentary: `little` text — The user generated commentary for the post." ([Post API Schema](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/post-api-schema))

There is no documented `content.media`-specific character limit. The `FIELD_LENGTH_TOO_LONG` error in the API error table is a generic limit that applies to all post types.

The third-party report of "text is cropped at 300 characters" for image posts ([Make Community](https://community.make.com/t/linkedin-company-image-post-text-is-cropped-at-300-characters/86000)) is consistent with the unescaped-parenthesis root cause: if the first `(` appears around character 300, everything after it drops.

### Alternative Image Post Formats

There is no alternative format that bypasses the `little` text escaping requirement. All LinkedIn post content types (`content.media`, `content.multiImage`, text-only) use the same `commentary` field with the same `little` text format. The fix is escaping, not switching formats.

For reference, the `multiImage` format (`content.multiImage.images[]`) is for 2–20 images in a carousel — it has no text display advantage over `content.media` for a single image.

### User-Facing Text Truncation: "See More"

The "see more" fold (where LinkedIn hides text and shows a click target) is a **display-layer behavior** unrelated to this bug:
- Feed preview folds at approximately 210 characters on desktop
- Full post view (direct URL) shows the complete text

The truncation described in this investigation is different: text is genuinely absent, not hidden. The post contains only the first sentence even when viewing the full post URL. No "see more" link exists because there is no hidden text — it was dropped at write time.

**Source says:** The approximate "see more" cutoff is "210 characters" for feed preview. ([postiv.ai LinkedIn Posts Specs](https://postiv.ai/blog/linkedin-posts-specs))

### Sponsored vs Organic Character Limits

For completeness: LinkedIn sponsored single-image ads recommend "up to 150 characters including spaces, emojis, and punctuation to avoid truncation (3,000 character maximum)" for introductory text. ([LinkedIn Single Image Ads Specs](https://www.linkedin.com/help/linkedin/answer/a426534))

This 150-character recommendation is for **ads**, not organic posts. Organic posts allow up to 3,000 characters of commentary.

## Recommendation

**Fix the escaping, not the post format.** Add a `little` text format escape function to `post-linkedin.js` and apply it to `post.postText` before assigning to `commentary`. Do not change the `content.media` structure — it is correct for single-image posts.

```javascript
/**
 * Escape reserved characters in LinkedIn's little text format.
 * Unescaped reserved chars cause silent truncation — no API error is returned.
 * Reserved chars: ( ) [ ] { } @ # * _ ~ < > \
 *
 * @param {string} text - Raw commentary text
 * @returns {string} Escaped text safe for LinkedIn commentary field
 */
function escapeLinkedInCommentary(text) {
  return text.replace(/[()[\]{}\@#*_~<>\\]/g, '\\$&');
}
```

Apply as: `commentary: escapeLinkedInCommentary(post.postText)`

**Caveat:** If `post.postText` is intentionally using `little` format syntax (e.g., `@[Name](URN)` mentions), those characters must NOT be escaped. In this codebase, `post.postText` is plain prose from the Google Sheet — no `little` format syntax is used — so full escaping is correct.

## Sources

- [Post API Schema — LinkedIn | Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/post-api-schema) — Authoritative field definitions; confirms `commentary` uses `little` text format across all post types
- [little Text Format — LinkedIn | Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format) — Reserved character list and escaping requirements
- [Posts API — LinkedIn | Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) — Full post creation reference
- [MultiImage API — LinkedIn | Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/multiimage-post-api) — Confirms no text display difference from `content.media`
- [Issues with Special Characters in LinkedIn API — Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5741122/issues-when-mentioning-urns-with-special-character) — Primary source confirming silent truncation on unescaped parentheses; official escaping solution
- [LinkedIn Company Image Post — Text Cropped at 300 Characters — Make Community](https://community.make.com/t/linkedin-company-image-post-text-is-cropped-at-300-characters/86000) — Third-party corroboration; symptom matches unescaped-parenthesis root cause
- [LinkedIn Single Image Ads Specs — LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a426534) — Confirms 150-char recommendation is for sponsored ads only, not organic posts
- [postiv.ai LinkedIn Posts Specs 2026](https://postiv.ai/blog/linkedin-posts-specs) — "See more" fold behavior at ~210 characters in feed preview

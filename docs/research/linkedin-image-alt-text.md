# Research: LinkedIn Image Alt Text API Support

**Project:** content-manager
**Last Updated:** 2026-06-04

## Update Log
| Date | Summary |
|------|---------|
| 2026-06-04 | Initial research |

## Findings

### Summary

LinkedIn's REST API **fully supports alt text on image attachments**. The `altText` field goes in `content.media.altText` in the `POST /rest/posts` body — not during the image upload flow. It is optional but documented and functional across all current API versions.

### Surprises & Gotchas

- **Alt text is set on the post, not the upload.** The `initializeUpload` / binary upload flow for images has no alt text field. It is only set when you create the post that uses the image. 🟢 high
- **GET responses don't return alt text.** When fetching a post via GET, `content.media` only contains the image URN and `taggedEntities` — `altText` is not included. Alt text is write-only from the API's perspective. 🟡 medium (single source)
- **LinkedIn may auto-generate alt text if you omit it.** The field is optional; LinkedIn uses AI/ML to generate fallback alt text when none is provided. 🟡 medium

### Findings

#### Field location — single image posts

🟢 **high confidence** — confirmed in official LinkedIn Posts API docs

Field: `POST /rest/posts` → `content.media.altText`

```json
{
  "author": "urn:li:person:{id}",
  "commentary": "Post text here",
  "visibility": "PUBLIC",
  "content": {
    "media": {
      "altText": "Description of the image for screen readers",
      "id": "urn:li:image:C5610AQFj6TdYowm17w"
    }
  },
  "lifecycleState": "PUBLISHED"
}
```

**Source says:** The Posts API docs show `altText` as a field on `content.media` with the example value `"testing for alt tags"`. ([LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-05))

#### Character limits

🟢 **high confidence** — documented in official Image API schema

**Source says:** "The alternate text of this thumbnail. Used for screen reader accessibility. Maximum length is 4,086 characters, recommended length is less than 120 characters." ([LinkedIn Image API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-05))

#### Multi-image posts

🟢 **high confidence** — per-image `altText` in `content.multiImage.images[]`

Each entry in the images array takes its own `altText`. Not relevant to the current content-manager use case (single images), but documented for completeness.

#### API versioning

Available across all current documented versions (202506–202605). No changelog entry marks when it was introduced — it predates the current versioning scheme.

### Recommendation

Add `altText: post.altText` to the `content.media` object in `post-linkedin.js`. Keep it conditional (`altText: post.altText || undefined`) so it is omitted cleanly when the queue row has no alt text, rather than sending an empty string.

## Sources

- [LinkedIn Posts API — Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-05) — official Posts API with `content.media.altText` example
- [LinkedIn Image API — Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-05) — image upload flow and alt text schema/character limits
- [LinkedIn MultiImage API — Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/multiimage-post-api?view=li-lms-2026-05) — per-image alt text in multi-image posts

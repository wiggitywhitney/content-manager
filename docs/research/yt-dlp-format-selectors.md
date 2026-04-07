# Research: yt-dlp Format Selectors for Pre-Merged MP4

**Project:** content-manager
**Last Updated:** 2026-04-07

## Update Log
| Date | Summary |
|------|---------|
| 2026-04-07 | Initial research — format selectors for pre-merged MP4 without ffmpeg |

## Findings

### Summary

Use `best[ext=mp4]` as the **first** option in a fallback chain to select a pre-merged (single-file) audio+video MP4 without requiring ffmpeg. For YouTube Shorts, format 18 is typically the only combined MP4 stream (360p). This is acceptable quality for micro.blog video posts.

### Surprises & Gotchas

**`best[ext=mp4]` selects combined streams — but the docs warn it may not always exist** 🟡 medium
> "Note that on some sites, the 'best' format might not be a combined stream but a video-only stream."
([yt-dlp README](https://github.com/yt-dlp/yt-dlp))

For YouTube specifically, format 18 (360p combined MP4) is reliably available for Shorts.

**ffmpeg-absent behavior is exit 0, not error** 🟢 high (empirically verified)
When `--merge-output-format mp4` is specified but ffmpeg is absent, yt-dlp prints a WARNING and exits 0 while downloading streams to separate files (`video.f137.mp4`, `video.f140.m4a`). The merged output file is never created. Published docs suggest it errors, but empirical testing shows exit 0. Do not rely on exit code to detect merge failure — check for the output file explicitly, or use a format selector that avoids merging entirely.

**`mweb` player client is less stable in 2025/2026** 🟡 medium
> "The mweb client option exists but is less stable."
([yt-dlp Extractors Wiki](https://github.com/yt-dlp/yt-dlp/wiki/extractors))

The original PRD recommended `--extractor-args "youtube:player-client=default,mweb"` as a workaround for YouTube's SABR streaming issue. It still works but is flagged as less stable. The recommended approach is to install a JS runtime (Node, Deno, bun, or QuickJS via yt-dlp-ejs).

**`--js-runtimes node` requires Node v20+** 🟢 high
yt-dlp requires Node v20+ or Deno since November 2025. `AnimMouse/setup-yt-dlp@v3` in GitHub Actions configures this automatically.

### Recommended Format Selector

```text
best[ext=mp4]/bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/best
```

- **`best[ext=mp4]`** — picks format 18 (combined 360p MP4 with audio) on YouTube Shorts. No ffmpeg required.
- **`bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]`** — high-quality merge fallback when ffmpeg is available (CI with `AnimMouse/setup-yt-dlp@v3`).
- **`best`** — final catch-all.

### Sources
- [yt-dlp GitHub Repository](https://github.com/yt-dlp/yt-dlp) — official README, format selection docs
- [yt-dlp Extractors Wiki](https://github.com/yt-dlp/yt-dlp/wiki/extractors) — player client options
- [GitHub Issue #12829](https://github.com/yt-dlp/yt-dlp/issues/12829) — ffmpeg-absent merge behavior
- Empirical testing (2026-04-07): `youtu.be/utJ6GgbM6Wk`, macOS without ffmpeg installed

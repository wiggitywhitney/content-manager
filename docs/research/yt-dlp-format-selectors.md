# Research: yt-dlp YouTube Download — Format Selectors & Bot Detection

**Project:** content-manager
**Last Updated:** 2026-06-03

## Update Log
| Date | Summary |
|------|---------|
| 2026-04-07 | Initial research — format selectors for pre-merged MP4 without ffmpeg |
| 2026-06-03 | Added bot detection / "sign in to confirm you're not a bot" CI findings and PO token solutions |

## Findings

### Summary

Use `best[ext=mp4]` as the **first** option in a fallback chain to select a pre-merged (single-file) audio+video MP4 without requiring ffmpeg. For YouTube Shorts, format 18 is typically the only combined MP4 stream (360p). This is acceptable quality for micro.blog video posts.

For bot detection in CI: the `yt-dlp -U` self-update step does NOT fix the "sign in to confirm you're not a bot" error — that is a datacenter IP reputation problem. The recommended headless fix is `bgutil-ytdlp-pot-provider`. A graceful text-only fallback in code is also strongly recommended as a safety net.

---

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

---

### Bot Detection: "Sign in to confirm you're not a bot"

**Root cause: datacenter IP, not yt-dlp version** 🟢 high
GitHub Actions runners use shared datacenter IPs that YouTube explicitly flags as bots. `yt-dlp -U` (self-update) does not help — the problem is IP reputation, not binary version.

**Chrome cookies are unreadable since Chrome 127 (July 2024)** 🟢 high
Chrome 127+ introduced app-bound encryption. No external process can decrypt Chrome's cookie store regardless of privilege level.
> "Any cookie extraction tutorial from before Chrome 127 (mid-2024) won't work on modern Chrome." ([DEV Community](https://dev.to/osovsky/6-ways-to-get-youtube-cookies-for-yt-dlp-in-2026-only-1-works-2cnb))

Firefox is the only viable browser-cookie source (plain SQLite, no encryption). But cookies expire every ~2 weeks and require manual re-export — not suitable for fully automated CI.

**Never use a browser extension to export cookies** 🟢 high
The popular "Get cookies.txt" Chrome extension was confirmed malware — it sent all cookies including banking tokens to its developer before Google removed it.

**PO tokens are per-video and expire in ~6 hours** 🟢 high
> "YouTube now binds PO Tokens to the video ID, so a new token needs to be generated for each video." ([yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide))

Static tokens stored in GitHub secrets don't work.

**Even correct PO tokens don't guarantee bypass** 🟢 high
> ⚠️ "Providing a PO token does not guarantee bypassing 403 errors or bot checks." ([bgutil-ytdlp-pot-provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider))

---

### Solutions

**Option A — bgutil-ytdlp-pot-provider (recommended for CI)** 🟢 high confidence

Officially recommended by yt-dlp maintainers. Uses BgUtils to generate per-video PO tokens headlessly (Node.js ≥20, no browser). The Script method works in GitHub Actions without a persistent service.

Requires: yt-dlp ≥ 2025.05.22, Node ≥20 (provided by `AnimMouse/setup-yt-dlp@v3`).

```yaml
- name: Install bgutil PO token provider
  run: |
    pip install bgutil-ytdlp-pot-provider
    git clone --single-branch --branch 1.3.1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /tmp/bgutil
    cd /tmp/bgutil/server && npm ci && npx tsc
```

Once installed, yt-dlp picks up the plugin automatically via its plugin discovery mechanism — no extra flags needed for the Script method.

**Option B — Graceful text-only fallback (recommended as safety net)** 🟢 high confidence

In `post-social-content.js`, when yt-dlp fails, catch the error and post text + YouTube link instead of skipping the entire dispatch. Bluesky and Mastodon will unfurl the YouTube link. This ensures something always gets posted even if YouTube tightens bot detection further.

**Option C — Firefox cookies (not recommended for CI)** 🟡 medium confidence
Store a Firefox-exported `cookies.txt` as a GitHub Actions secret. Works while fresh, but expires every ~2 weeks and requires manual rotation using Whitney's personal Google account credentials.

---

### Recommended Format Selector

```text
best[ext=mp4]/bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/best
```

- **`best[ext=mp4]`** — picks format 18 (combined 360p MP4 with audio) on YouTube Shorts. No ffmpeg required.
- **`bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]`** — high-quality merge fallback when ffmpeg is available (CI with `AnimMouse/setup-yt-dlp@v3`).
- **`best`** — final catch-all.

---

### Sources
- [yt-dlp PO Token Guide (GitHub Wiki)](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide)
- [bgutil-ytdlp-pot-provider (GitHub)](https://github.com/Brainicism/bgutil-ytdlp-pot-provider)
- [6 Ways to Get YouTube Cookies for yt-dlp in 2026 — Only 1 Works (DEV Community)](https://dev.to/osovsky/6-ways-to-get-youtube-cookies-for-yt-dlp-in-2026-only-1-works-2cnb)
- [PO Token System DeepWiki](https://deepwiki.com/yt-dlp/yt-dlp/3.4.1-potoken-authentication-system)
- [yt-dlp GitHub Repository](https://github.com/yt-dlp/yt-dlp) — official README, format selection docs
- [yt-dlp Extractors Wiki](https://github.com/yt-dlp/yt-dlp/wiki/extractors) — player client options
- [youtube-po-token-generator (GitHub)](https://github.com/YunzheZJU/youtube-po-token-generator)
- Empirical testing (2026-04-07): `youtu.be/utJ6GgbM6Wk`, macOS without ffmpeg installed

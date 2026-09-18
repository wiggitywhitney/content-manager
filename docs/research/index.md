# Research Index

| File | Description | Last Updated |
|------|-------------|--------------|
| [yt-dlp-format-selectors.md](yt-dlp-format-selectors.md) | yt-dlp format selectors, bot detection ("sign in to confirm you're not a bot") in CI, and PO token solutions | 2026-06-03 |
| [microblog-api.md](microblog-api.md) | Micro.blog API capabilities: page editing, cross-posting architecture, POSSE vs direct posting, `mp-syndicate-to[]` per-post syndication suppression | 2026-06-26 |
| [video-upload-apis.md](video-upload-apis.md) | Video upload flows for Bluesky (separate video service + service token), Mastodon (async 202 poll), and LinkedIn (4-step init/upload/finalize/poll) | 2026-04-25 |
| [linkedin-image-post-text-truncation.md](linkedin-image-post-text-truncation.md) | LinkedIn image post commentary silent truncation — root cause is unescaped `little` text format reserved characters, not the `content.media` format | 2026-05-01 |
| [linkedin-image-alt-text.md](linkedin-image-alt-text.md) | LinkedIn REST API image alt text support — `content.media.altText` in the post body, not the upload flow; write-only (not returned on GET) | 2026-06-04 |
| [datadog-ci-observability.md](datadog-ci-observability.md) | Datadog CI Visibility for GitHub Actions (GitHub App, zero workflow changes), log forwarding toggle, custom metrics via HTTP API, log-based and metric monitors | 2026-06-15 |
| [sharp.md](sharp.md) | sharp image processing: PNG→JPEG conversion, resize API (fit: inside, withoutEnlargement), CJS usage, macOS Homebrew libvips gotcha | 2026-06-18 |
| [devbox-install-and-scripts.md](devbox-install-and-scripts.md) | devbox has no Homebrew install path (curl script only); auto-installs Nix; `shell.scripts` schema for custom `devbox run` commands | 2026-09-18 |
| [dot-agent-deck-install-and-config.md](dot-agent-deck-install-and-config.md) | dot-agent-deck install/launch verification; devbox is not a dot-agent-deck dependency — an independent choice this repo's PRD made | 2026-09-18 |
| [devbox-and-claude-code-sandboxing.md](devbox-and-claude-code-sandboxing.md) | devbox provides zero OS-level sandboxing (Nix package isolation only); Claude Code's real `/sandbox` feature OS-enforces filesystem/network limits, separate from and more reliable than permission allowlists | 2026-09-18 |
| [dot-ai-devbox-config-verification.md](dot-ai-devbox-config-verification.md) | Viktor Farcic's actual dot-ai devbox.json/.dot-agent-deck.toml — bare `claude` for most roles, `claude --model sonnet` for release; unattended-permission mechanism isn't in the committed config | 2026-09-18 |

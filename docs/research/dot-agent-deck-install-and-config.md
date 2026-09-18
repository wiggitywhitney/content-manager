# Research: dot-agent-deck Install and Config

**Project:** content-manager
**Last Updated:** 2026-09-18

## Update Log
| Date | Summary |
|------|---------|
| 2026-09-18 | Initial research |

## Findings

### Summary
`dot-agent-deck` (vfarcic) is actively developed (v0.40.x as of Sept 2026). Prior design assumptions in PRD #126 — brew tap install, `.dot-agent-deck.toml` filename/generation, the `agent = "claude"` status-tracking requirement, and the timeout-key top-level-ordering requirement — all check out against current docs; no contradictions found.

### Surprises & Gotchas
- The official quick-start renders install and hook-setup as two separate commands, easy to misread as one: `brew tap vfarcic/tap && brew install dot-agent-deck`, then separately `dot-agent-deck hooks install dot-agent-deck`. 🟢
- Launch is a single bare command: `dot-agent-deck` — no `start` subcommand, no separate daemon step. "The first `dot-agent-deck` invocation auto-spawns the daemon and connects to it." 🟢
- **Intel Macs are not served by the Nix flake** — only by release binaries + the Homebrew tap — because "the nixpkgs this flake pins has dropped `x86_64-darwin`." On Intel, brew isn't just convenient, it's the only supported path besides raw binaries. 🟢
- **devbox is not a dot-agent-deck dependency at all.** It appears only as (a) an example wrapper command for scheduled/dispatched agent launches ("via a wrapper like `devbox run agent-new`"), and (b) the recommended toolchain for *contributors* to the dot-agent-deck project itself — not for end users. Using devbox for role launchers is entirely this repo's own choice (Decision #8's script naming), independent of the tool. 🟢
- Versioning is compatibility-first while in 0.x: a protocol/compatibility-breaking change bumps the **minor** version, not major — check CHANGELOG.md before upgrading minors. 🟢
- Windows has no native support (daemon reports `Unsupported`, no `.exe` in release artifacts) — WSL only. Not relevant to this repo's macOS environment. 🟢

### Findings
1. **Install command still correct** 🟢 — `brew tap vfarcic/tap && brew install dot-agent-deck` is current as of Sept 2026; a beta channel also exists (`brew install vfarcic/tap/dot-agent-deck-beta`).
2. **Launch / no-config behavior** 🟡 partially confirmed — bare `dot-agent-deck` launches TUI+daemon together. Docs describe on-demand config generation (`Ctrl+d` then `g`, or `dot-agent-deck init`) rather than a hard error, but the exact zero-config first-launch screen (empty dashboard vs. a prompt to generate config) is not explicitly documented — worth a live check before relying on it in the milestone's acceptance step.
3. **devbox is not a dot-agent-deck dependency** 🟢 — confirmed independent choice.
4. No other macOS-breaking changes found beyond the Intel/Nix-flake caveat above. 🟢

### Recommendation
Proceed with the PRD's existing plan for `dot-agent-deck` itself — no corrections needed. Add one verification step to the install milestone: run `dot-agent-deck` once in the repo with no `.dot-agent-deck.toml` present and confirm the actual empty-state UI/behavior before writing the milestone's acceptance criteria around it.

### Caveats
The "empty repo, zero config, first launch" exact behavior is inferred from generation-path docs, not directly quoted from a specific screen description — verify live.

## Sources
- [vfarcic/dot-agent-deck](https://github.com/vfarcic/dot-agent-deck)
- [agent-deck.devopstoolkit.ai](https://agent-deck.devopstoolkit.ai/)
- [Installation docs](https://agent-deck.devopstoolkit.ai/docs/installation/)
- [Getting Started docs](https://agent-deck.devopstoolkit.ai/docs/getting-started/)
- [CHANGELOG.md](https://github.com/vfarcic/dot-agent-deck/blob/main/CHANGELOG.md)
- [Release v0.40.2](https://github.com/vfarcic/dot-agent-deck/releases/tag/v0.40.2)

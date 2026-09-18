# Research: dot-ai's Actual devbox.json and .dot-agent-deck.toml Config

**Project:** content-manager
**Last Updated:** 2026-09-18

## Update Log
| Date | Summary |
|------|---------|
| 2026-09-18 | Initial research |

## Findings

### Summary
`dot-ai` (Viktor Farcic's real project, github.com/vfarcic/dot-ai) is a public repo containing its actual `devbox.json` and `.dot-agent-deck.toml`. Its `devbox.json` scripts are minimal: `agent` and `agent-tester` are both literally `["claude"]`, and `agent-medium` is `["claude --model sonnet"]` — no other agent-related scripts exist. Its `.dot-agent-deck.toml` maps orchestrator/coder/reviewer/auditor/documenter/tester roles to `command = "devbox run agent"` (or `agent-tester`, functionally identical), and only `release` to `command = "devbox run agent-medium"`. No role's command includes a permission-mode flag (`--dangerously-skip-permissions`, `--permission-mode`, `--allowedTools`/`--disallowedTools`) — whatever lets these roles run unattended is not visible in this repo's committed config.

### Findings

**`devbox.json` scripts** 🟢 high confidence — quoted verbatim from [github.com/vfarcic/dot-ai/blob/main/devbox.json](https://github.com/vfarcic/dot-ai/blob/main/devbox.json):
```json
"scripts": {
  "agent":        ["claude"],
  "agent-oc":     ["opencode"],
  "agent-tester": ["claude"],
  "agent-medium": ["claude --model sonnet"]
}
```

**`.dot-agent-deck.toml` role → command mapping** 🟢 high confidence — from [github.com/vfarcic/dot-ai/blob/main/.dot-agent-deck.toml](https://github.com/vfarcic/dot-ai/blob/main/.dot-agent-deck.toml):
- `orchestrator`, `coder`, `reviewer`, `auditor`, `documenter` → `command = "devbox run agent"` (plain `claude`)
- `tester` → `command = "devbox run agent-tester"` (also plain `claude`, separate script but identical body)
- `release` → `command = "devbox run agent-medium"` (`claude --model sonnet`)

**No permission-mode flag anywhere in committed config** 🟢 high confidence — `prompt_template` strings per role are long behavioral instructions (division of labor, TDD flow, "never delegate") but contain zero mention of permission modes or bypass flags. `.claude/settings.json` in the same repo ([raw.githubusercontent.com/.../main/.claude/settings.json](https://raw.githubusercontent.com/vfarcic/dot-ai/main/.claude/settings.json)) only configures `enableAllProjectMcpServers`, `enabledMcpjsonServers`, and a `UserPromptSubmit` hook — no `permissions` block. No `.claude/settings.local.json` is visible (expected — typically gitignored).

### Interpretation
Whatever mechanism lets Viktor's roles run unattended without stopping for permission prompts is not committed to the `dot-ai` repo — most likely a local, gitignored `settings.local.json` or a global `~/.claude/settings.json` with a bypass/accept-edits mode, or something the `dot-agent-deck` daemon itself handles when spawning panes (not visible from these config files, and not documented in `dot-agent-deck`'s own README/getting-started docs either). This repo cannot copy an invisible mechanism — the permission-handling decision had to be made independently (see [Research: devbox and Claude Code sandboxing](devbox-and-claude-code-sandboxing.md) and PRD #126 Decision #15).

### Recommendation
Match dot-ai's verified script-body pattern exactly for the parts that are visible: bare `claude` for all roles except `release`, which gets `claude --model sonnet`. Do not attempt to infer or replicate an unattended-permission mechanism from this repo, since it isn't present in the committed files — decide that independently.

### Caveats
`dot-ai` is a real, actively-used repo but reflects one operator's (Viktor's) personal, uncommitted local configuration for the permission question — its absence from the repo is evidence of *where it lives*, not evidence that no such mechanism exists.

## Sources
- [vfarcic/dot-ai devbox.json](https://github.com/vfarcic/dot-ai/blob/main/devbox.json)
- [vfarcic/dot-ai .dot-agent-deck.toml](https://github.com/vfarcic/dot-ai/blob/main/.dot-agent-deck.toml)
- [vfarcic/dot-ai .claude/settings.json](https://raw.githubusercontent.com/vfarcic/dot-ai/main/.claude/settings.json)

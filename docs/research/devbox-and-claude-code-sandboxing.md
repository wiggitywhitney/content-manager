# Research: devbox Sandboxing (none) vs. Claude Code's `/sandbox` Feature

**Project:** content-manager
**Last Updated:** 2026-09-18

## Update Log
| Date | Summary |
|------|---------|
| 2026-09-18 | Initial research |

## Findings

### Summary
Devbox provides zero OS-level sandboxing — its "isolation" is Nix-based reproducible *package/dependency* management only; a process run via `devbox run`/`devbox shell` has full, unrestricted host filesystem and network access, identical to a normal shell. Claude Code, separately, has a real, named, OS-enforced sandbox feature (`/sandbox`) that restricts what Bash/PowerShell/Monitor commands and their children can reach — distinct from and complementary to the permission-prompt allowlist system. It is off by default and fails open unless hardened.

### Surprises & Gotchas
- Devbox's own docs use "isolated" to mean "isolated from other Devbox projects on your laptop," not "isolated from the host." A GitHub feature request (jetify-com/devbox#403) confirms the dev shell has read/write access to the outside environment.
- Claude Code's sandbox network isolation is proxy-based (checks an allowlist, returns 403), with a Seatbelt (macOS) / bubblewrap (Linux/WSL2) kernel-level backstop only for tools that ignore proxy env vars — not a uniform kernel-level network block for everything.
- **The sandbox fails open by default**: if it can't start for any reason, Claude Code prints a warning and runs commands unsandboxed. `sandbox.failIfUnavailable: true` is required for a hard gate instead of a silent fallback.
- `--dangerously-skip-permissions` and `/sandbox` are orthogonal, not substitutes: skip-permissions controls *whether* a tool call runs at all (no protection); sandbox controls *what a Bash command can reach* once it runs. Skipping permissions alone means genuinely unrestricted host access.
- Claude Code's own docs describe permission-allowlist matching as "best-effort, not a hardened shell sandbox" — documented gaps include exact-match vs. glob/prefix distinctions, subshells (`$(...)`), piped/chained commands, and exec wrappers (`watch`, `find -exec`) all causing prompts to fire despite a matching allow rule existing. This is the likely root cause of "scoped allowlists still produce a thousand permission requests" in practice.

### Findings

**Devbox = Nix package isolation only, no filesystem/network sandboxing** 🟢 high confidence
- **Source says:** "Devbox creates isolated shells for development... the packages it manages are at the operating-system level" ([Devbox docs](https://www.jetify.com/docs/devbox))
- **Source says:** "Devbox can create isolated environments right on your laptop, without an extra-layer of virtualization slowing your file system or every command" ([jetify.com/devbox](https://www.jetify.com/devbox))
- **Source says:** "the development environment inside devbox will often not be independent of the outside environment... the dev environment still has read/write access to the outside environment" ([jetify-com/devbox#403](https://github.com/jetify-com/devbox/issues/403))
- **Interpretation:** devbox's "isolation" claim is about reproducible dependency versions across machines/projects, not process containment. Any process launched via devbox (including a `claude` CLI session in a `devbox run agent-*` script) runs with full, ordinary host access.

**Claude Code sandbox is real, OS-enforced, opt-in, filesystem+network scoped** 🟢 high confidence
- **Source says:** "The Bash sandbox lets Claude run most shell commands without stopping to ask permission... the operating system enforces that boundary for every Bash, PowerShell, or Monitor command and its child processes." ([Sandboxing docs](https://code.claude.com/docs/en/sandboxing))
- macOS: Seatbelt (built-in); Linux/WSL2: bubblewrap + socat; native Windows/WSL1 unsupported.
- Fallback is soft-fail-open unless `sandbox.failIfUnavailable: true` is set in settings.
- **Source says:** permission-allowlist matching is "best-effort, not a hardened shell sandbox" and should not be relied on as a security boundary alone ([Permissions docs](https://code.claude.com/docs/en/permissions))

**Auto mode (model-classifier-based approval)** 🟡 medium confidence — a separate, newer 2026 feature distinct from sandboxing; findings here are aggregated from search summaries rather than a full fetch of the primary source, so treat as directional rather than verbatim-confirmed.

### Recommendation
For unattended/multi-agent operation via `dot-agent-deck`: devbox provides no containment on its own — treat any devbox-managed process as running with full host access, exactly as if launched from a normal shell. For the Claude Code sessions themselves, do not rely on `--dangerously-skip-permissions` alone, and do not rely on a fine-grained permission allowlist alone (both leave either full access or unreliable prompt-suppression). Instead, pair `--dangerously-skip-permissions` (or an equivalent bypass mode) with Claude Code's own `/sandbox` feature, and set `sandbox.failIfUnavailable: true` so a failed sandbox start halts rather than silently running unsandboxed. This solves both problems at once: no permission-prompt friction (skip-permissions), and a real OS-enforced containment boundary on what any role's Bash commands can reach (sandbox) — which a permission allowlist was never actually providing reliably in the first place.

### Caveats
- No single canonical devbox doc uses the literal phrase "not a sandbox" — the conclusion is drawn from consistent framing across docs/README/GitHub issue, not one explicit disclaimer.
- The sandbox's network path has a documented soft spot: proxy-unaware tools fall back to the kernel-level backstop rather than the primary allowlist-checked path — worth confirming in practice which category the tools these roles use (git, npm, gh) fall into.
- Anthropic's own recommended defense-in-depth pattern for fully unattended operation is a devcontainer with a non-root user, layered on top of the sandbox — not evaluated further here since this repo's Decision #9 already declined an analogous OS-level isolation layer (for the Slack notifier script) as disproportionate for a single-operator machine; the same reasoning plausibly applies here, but that's a judgment call, not a research finding.

## Sources
- [Devbox docs](https://www.jetify.com/docs/devbox)
- [jetify.com/devbox](https://www.jetify.com/devbox)
- [jetify-com/devbox](https://github.com/jetify-com/devbox)
- [jetify-com/devbox#403](https://github.com/jetify-com/devbox/issues/403)
- [Devbox FAQ](https://www.jetify.com/docs/devbox/faq)
- [Claude Code Sandboxing docs](https://code.claude.com/docs/en/sandboxing)
- [Claude Code auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode)
- [anthropics/claude-code#72855](https://github.com/anthropics/claude-code/issues/72855)
- [anthropics/claude-code#13340](https://github.com/anthropics/claude-code/issues/13340)
- [anthropics/claude-code#18160](https://github.com/anthropics/claude-code/issues/18160)
- [Claude Code Permissions docs](https://code.claude.com/docs/en/permissions)

# PRD: Adopt dot-agent-deck orchestration

**Issue**: [#126](https://github.com/wiggitywhitney/content-manager/issues/126)
**Status**: Not Started
**Priority**: High
**Created**: 2026-09-11

## Problem Statement

Work on this repo currently runs in a single Claude Code session end to end — the same agent implements, tests, and reviews its own changes. A reviewer that shares the author's model shares the author's blind spots; there is no structural check that catches what the implementing agent itself would miss.

## Solution Overview

Install [`dot-agent-deck`](https://github.com/vfarcic/dot-agent-deck) (Viktor Farcic's terminal dashboard + daemon that runs several agent CLI sessions as panes and passes messages between them) and configure it for this repo, following his own actual usage rather than the tool's own dogfooding demo.

**Context that must ground Milestone 0's design decisions**, established during prior research (not yet reflected below as final decisions):

- `dot-agent-deck`'s own `.dot-agent-deck.toml` (its dogfooding config) defines three orchestration presets — `mixed`, `anthropic`, `GPT` — each with six roles (orchestrator, coder, reviewer, auditor, tester, release). Only the `mixed` preset actually splits vendors across roles (reviewer on `pi`, auditor on `opencode`, the rest on Claude).
- **`dot-ai`** (a real project Viktor runs it on) uses a single orchestration with **seven** roles: the same six plus a `documenter` role. Orchestrator, coder, reviewer, auditor, and documenter all run the *same* command (`devbox run agent` — one Claude harness). Only `tester` and `release` differ, and both differences are Claude-side configuration, not a different vendor. **No cross-vendor mixing is actually running in this config.**
- **`dot-ai-infra`** doesn't use the orchestration/roles feature at all — just a monitoring mode with status panes.
- Conclusion carried into this PRD: the mixed-vendor idea is real and demonstrated, but it is not what Viktor's own production usage runs. Milestone 0 must decide, with this evidence in hand, whether to adopt the `dot-ai` pattern (same-vendor Claude, `documenter` role, no cross-vendor split) or deliberately deviate and pursue mixed-vendor review anyway.

## User Experience

### Current workflow
1. Whitney works PRDs in a single Claude Code session using the existing `/prd-*` skills.
2. The same session implements, tests, and reviews its own work; CodeRabbit is the only outside check, and it runs post-hoc against a pushed branch.

### New workflow (after this PRD)
1. Whitney opens `dot-agent-deck`'s TUI and hands the orchestrator a PRD to work.
2. The orchestrator reads the PRD, produces a test-plan table, and stops for Whitney's sign-off (Gate 1).
3. Separate agent roles handle implementation, testing, review, and audit, running unattended between the two gates.
4. Whitney reviews and confirms before merge (Gate 2).

## Technical Architecture

- **Tool**: `dot-agent-deck`, installed via `brew tap vfarcic/tap && brew install dot-agent-deck` (Decision #1 — not the bare `brew install dot-agent-deck` originally assumed). Infrastructure (a Rust daemon + TUI), not a prompt or skill — it owns process lifecycle, message delivery, and idle detection.
- **Config location**: `.dot-agent-deck.toml` at this repo's root, per-project — matching how Viktor's own `dot-ai` and `dot-ai-infra` each carry their own config rather than a shared central one.
- **Config authoring**: start from `dot-agent-deck`'s own project-analyzing generator (`Ctrl+d` then `g` in the dashboard) or `dot-agent-deck init`'s starter template, then tune against `dot-ai`'s pattern (Decision #2) — not a hand-authored config copied wholesale from `dot-ai`.
- **Devbox scripts**: each role invokes `devbox run <script>` (e.g. `agent-coder`, `agent-tester`); this repo has no `devbox.json` today, so the scripts need to be defined from scratch, not copied from an existing setup. Every such role must also set an explicit `agent = "claude"` key on its block (Decision #3) — without it, the deck cannot tell what a launcher command runs and the role gets no status tracking.
- **Escalation model**: two user gates only — test-plan approval before delegation begins, and merge confirmation at the end. Everything between runs unattended.
- **Idle-worker timeout**: if `worker_response_timeout_minutes` is customized, it must be a top-level key positioned above every `[[modes]]`/`[[orchestrations]]` table header in the file, or it is silently absorbed into the last table and does nothing (Decision #4).
- **Notification channel**: Viktor's own config notifies via Telegram at four moments (escalation, merge gate, run finished, worker-stuck), but this is an unshipped example recipe, not a deck feature — the channel is arbitrary (Slack MCP, `ntfy`, desktop notifier, SMS, webhook all work identically) and carries real security requirements regardless of choice (Decision #5). This repo replaces Telegram with Slack via incoming webhook (Decision #9).

## Success Criteria

- `dot-agent-deck` is installed and its daemon/TUI runs against this repo without error.
- A `.dot-agent-deck.toml` exists at the repo root defining every role decided in Milestone 0, each backed by a working devbox script.
- The orchestrator's prompt correctly reads this repo's `prds/[id]-*.md` files and produces a test-plan table Whitney can approve.
- PRD #125 (auto-adjusting posting cadence) is successfully implemented end to end through the deck, from test-plan approval through merge confirmation — this run doubles as the deck's own validation (Decision #10).
- The two-gate model holds in practice: no role notifies or blocks on Whitney outside the test-plan and merge gates.

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Design decisions (role set, vendor mix, notification channel) get made ad hoc mid-implementation instead of settled upfront, producing a config that has to be reworked | High | Settled upfront in Milestone 0 as Decisions #6-10; every later milestone opens with a step reading Milestone 0's Decision Log entries. |
| Mixed-vendor roles were considered but not chosen — same-vendor Claude avoids the ongoing CLI-maintenance cost of installing and maintaining other vendors (codex, pi, opencode) | Medium | Resolved: Decision #7 commits to same-vendor Claude, accepting the weaker-independence trade-off explicitly rather than paying the maintenance cost. |
| Running PRD #125 as the first real workload, with no separate dry run, risks compounding a deck misconfiguration with a real feature's complexity | Medium | Accepted per Decision #10: if config, prompts, or role handoffs are broken, the branch is discarded without merging and the config is fixed before retrying — low cost since PRD #125 itself is low-stakes. |
| Cost per run is unmeasured — every role potentially running at high reasoning effort on a frontier model is not free | Medium | No existing cost instrument is assumed. Flagged as an open question below rather than silently ignored. |

## Dependencies

**None** — self-contained tooling addition. Does not block or depend on any other open PRD in this repo.

## Design Notes

- The feature PR created by `/prd-done` needs the `run-acceptance` label to trigger acceptance gate CI. This is handled automatically by `/prd-done` when acceptance gate tests are detected.

## Decision Log

*(Populated as Milestone 0 and later milestones make real decisions. The Context subsection under Solution Overview above is prior research, not yet a decision.)*

### 1. Installation command and hook setup
**Decision**: Install via `brew tap vfarcic/tap && brew install dot-agent-deck`, not the bare `brew install dot-agent-deck` originally assumed. No separate `hooks install` step — agent-detection hooks are auto-installed on first launch.
**Rationale**: Verified against `dot-agent-deck`'s own `README.md` and `docs/getting-started.md`. The bare install command would fail outright since the tool isn't in Homebrew's default tap.

### 2. Config authored via the tool's own generator, not hand-copied from `dot-ai`
**Decision**: Milestone 0 and the `.dot-agent-deck.toml` milestone start from `dot-agent-deck`'s own project-analyzing generator (`Ctrl+d` then `g` in the dashboard) or `dot-agent-deck init`'s starter template, then tune the result against `dot-ai`'s pattern — rather than hand-authoring a config copied wholesale from `dot-ai` as originally planned.
**Rationale**: This is Viktor's own documented recommended path (`docs/getting-started.md`: "The fastest way to get the config is to let an agent generate it... Treat the result as a starting point and tune it as you learn what works for your project"). A project-specific proposal is more likely to fit this repo's actual structure than porting a different project's config verbatim.

### 3. `agent` key required for every launcher-wrapped role
**Decision**: Every role in `.dot-agent-deck.toml` that invokes its harness through a `devbox run <script>` launcher must also set an explicit `agent = "claude"` (or the appropriate value) on that role's block.
**Rationale**: The deck identifies an agent by reading the first word of a pane's command; a launcher like `devbox run agent-coder` hides that. Without the explicit `agent` key the role gets **no status tracking at all** (confirmed in `docs/configuration.md`). This was missing from the original plan and would have silently broken dashboard visibility for every role.

### 4. `worker_response_timeout_minutes` placement
**Decision**: If a custom idle-worker timeout is set, `worker_response_timeout_minutes` must be written as a top-level key positioned above every `[[modes]]`/`[[orchestrations]]` table header in `.dot-agent-deck.toml`.
**Rationale**: TOML assigns any key written after a table header to that table; a misplaced timeout is silently absorbed into the last table, `dot-agent-deck validate` still reports the config valid, and the daemon quietly keeps the 120-minute default with no error anywhere (confirmed in `docs/idle-workers-and-notifications.md`). This resolves the open question about stuck-worker behavior: the mechanism already exists in the tool and needs no new convention here, only correct placement.

### 5. Notification design: idle-worker detection and the notification recipe are separate; channel choice carries real security requirements
**Decision**: Treat idle-worker detection (the `worker_response_timeout_minutes` daemon timer) as a real, tested feature to configure, separate from the four-moment "notify a human" recipe, which is unshipped example prompt text from Viktor's own project, not a deck feature. If the notification recipe is adopted, whatever channel replaces Telegram (Slack MCP, `ntfy`, desktop notifier, SMS, webhook — the deck has no opinion) must: always pass an explicit destination id from configuration rather than falling back to "most recently active," never let the agent read the channel's inbound/updates side, and pin the MCP server's version rather than tracking `@latest`. Only the orchestrator ever notifies; workers never do.
**Rationale**: Sourced from `docs/idle-workers-and-notifications.md`. The security requirements are stated as requirements, not suggestions, for this class of setup — an unauthenticated inbound channel is a prompt-injection path, and omitting an explicit destination id lets anyone who discovers the bot's identity intercept the next notification. Also worth weighing: notification instructions living in the orchestrator's prompt can be silently lost on context compaction, while the daemon's idle-worker report cannot, since it's injected fresh at fire time.

### 6. Role set: `dot-ai`'s seven roles
**Decision**: Adopt `dot-ai`'s seven roles — orchestrator, coder, reviewer, auditor, tester, release, documenter — rather than the base six from `dot-agent-deck`'s own dogfooding presets.
**Rationale**: Matches Viktor's actual production usage on `dot-ai`, and this repo's own PRD workflow already treats documentation as a required closing step (`docs/dot-agent-deck.md`, `PROGRESS.md`, `ROADMAP.md`) — a dedicated `documenter` role fits that existing pattern rather than folding it into `coder` or `orchestrator`.

### 7. Vendor/harness: same-vendor Claude throughout
**Decision**: All seven roles run on Claude, matching `dot-ai`'s actual usage — not the mixed-vendor split (`pi` for reviewer, `opencode` for auditor) from `dot-agent-deck`'s own `mixed` dogfooding preset.
**Rationale**: Avoids installing and maintaining two additional agent CLIs for a split that isn't what Viktor's own production project actually runs. Trade-off accepted explicitly: this does not give a structurally different model as reviewer/auditor, only a separate Claude session with separate context — a real but weaker form of independence than mixed-vendor review would give against this PRD's stated problem (a reviewer sharing the author's blind spots).

### 8. Devbox script naming: one script per role
**Decision**: Each role gets its own `devbox run` script named `agent-<role>` — `agent-orchestrator`, `agent-coder`, `agent-reviewer`, `agent-auditor`, `agent-tester`, `agent-release`, `agent-documenter` — rather than one shared script taking a `--role` argument.
**Rationale**: Matches `dot-ai`'s own naming convention (`agent-coder`, `agent-tester`) that its config already references, and keeps each role's `agent = "claude"` key (Decision #3) attached to an unambiguous, individually-editable script block.

### 9. Notification channel: Slack via incoming webhook
**Decision**: Replace Viktor's Telegram notifications with Slack, delivered via a single incoming webhook URL stored as a GSM secret and posted to with `curl` from each of the four notify moments — not a Slack bot token + `chat.postMessage`, and not an MCP server.
**Rationale**: An incoming webhook is bound to one specific channel at creation time, satisfying Decision #5's "explicit destination id" requirement by construction. It is push-only with no inbound/updates side to read, satisfying the "never let the agent read the channel's inbound side" requirement without extra care. And because there's no MCP server involved at all, the "pin the MCP server's version" requirement doesn't apply — a webhook URL has no version to pin. Minimal setup: no bot install, no OAuth scopes, no server to run.

### 10. Dry-run scope: run PRD #125 directly, discard the branch if it fails
**Decision**: Skip naming a separate low-stakes task for the dry-run milestone. Run PRD #125 (auto-adjusting posting cadence) directly through the deck as the first real run. If the deck's config, prompts, or role handoffs turn out broken, discard that branch without merging and fix the config — rather than spending a milestone validating on throwaway work first.
**Rationale**: Whitney's call: PRD #125 is itself low enough stakes that a discarded branch costs little, and skipping a separate dry-run task collapses two milestones into one. This merges the "Dry run validated on a low-stakes task" milestone into "PRD #125 implemented through the deck" below — see the updated Milestones section.

## Milestones

- [x] **Milestone 0 — Final design decisions made with Whitney, PRD updated.** Resolved as Decisions #6-10: (a) role set — `dot-ai`'s seven roles including `documenter` (Decision #6); (b) vendor/harness — same-vendor Claude throughout, no mixed-vendor split (Decision #7); (c) devbox scripts — one per role, named `agent-<role>` (Decision #8); (d) notification channel — Slack via incoming webhook, satisfying Decision #5's security requirements (Decision #9); (e) dry-run scope — no separate low-stakes task; run PRD #125 directly and discard the branch if it fails (Decision #10, which also merges the former "dry run" milestone into "PRD #125 implemented through the deck" below).
- [ ] **`dot-agent-deck` and devbox installed.** Updated per Decision #1. Step 0: Read Milestone 0's Decision Log entries. Install via `brew tap vfarcic/tap && brew install dot-agent-deck` (not the bare `brew install dot-agent-deck`) and devbox; create `devbox.json` with the seven `agent-<role>` scripts decided in Decision #8. Confirm the daemon starts and the TUI attaches against this repo with no roles configured yet. No separate hooks-install step is needed — agent-detection hooks install automatically on first launch.
- [ ] **`.dot-agent-deck.toml` written.** Updated per Decisions #2, #3, #4, #6, #7, #8, #9. Step 0: Read Milestone 0's Decision Log entries. Start from `dot-agent-deck`'s own generator (`Ctrl+d` then `g`) or `dot-agent-deck init`'s starter template (Decision #2), then define the modes/panes and `[[orchestrations.roles]]` for all seven roles (Decision #6), each pointing at its `agent-<role>` devbox script (Decision #8) and carrying an explicit `agent = "claude"` key (Decision #3, #7 — every role uses Claude) — a role invoked through a `devbox run` launcher gets no status tracking without this key. Wire the Slack incoming webhook (Decision #9) into the notification recipe for the four notify moments. For every role's `prompt_template`, adapt it from Viktor's original wherever it references repo-specific conventions that differ here (e.g., PRD file locations, test commands, terminology) — do not copy a role's prompt verbatim where this repo's conventions diverge from his. If `worker_response_timeout_minutes` is customized, it must be a top-level key placed above every `[[modes]]`/`[[orchestrations]]` table header in the file, never appended after one (Decision #4) — verify placement, since `dot-agent-deck validate` will not catch a misplaced key.
- [ ] **Orchestrator prompt adapted to this repo.** Step 0: Read Milestone 0's Decision Log entries and the previous two milestones' output. Rewrite the orchestrator's `prompt_template` to read this repo's actual `prds/[id]-*.md` files and produce a test-plan table matching this repo's own test tiers (`npm run` scripts, `.claude/verify.json`'s `acceptance_test`), not Viktor's original L1/L2/chain-smoke terminology, which does not exist in this repo.
- [ ] **PRD #125 implemented through the deck.** Step 0: Read the four previous milestones' output. Per Decision #10, this is both the first real run and the deck's validation — there is no separate dry run. Run PRD #125 (auto-adjusting posting cadence) end to end through the deck: test-plan approval, delegated implementation/test/review/audit, and merge confirmation. If config, prompts, or role handoffs turn out broken, discard the branch without merging, fix the config, and retry rather than pushing a broken run through to merge.
- [ ] **Setup documented.** Write a new `docs/dot-agent-deck.md` covering what was installed, the final `.dot-agent-deck.toml` role set, and how to invoke the deck for a future PRD, so this doesn't need to be reconstructed from git history next time.

## Implementation Plan

### Phase 1: Design
- Milestone 0

### Phase 2: Infrastructure
- Install `dot-agent-deck` and devbox
- Write `.dot-agent-deck.toml`
- Adapt the orchestrator prompt

### Phase 3: Validation
- PRD #125 through the deck (also serves as the deck's own validation — Decision #10)
- Documentation

## Open Questions

- ~~What replaces Telegram for the four notification moments?~~ Resolved by Decision #9: Slack via incoming webhook, satisfying Decision #5's security requirements (explicit destination id, no inbound reading, no MCP server to version-pin).
- Is there any cost instrument to track spend across a multi-role run before this is adopted for real work, or is that accepted as unmeasured for now?
- ~~If PRD #125's dry run or real run surfaces a stuck-worker case, what should the 120-minute-idle equivalent behavior be here, given there's no existing daemon-timeout convention in this repo?~~ Resolved by Decision #4: the timeout mechanism (`worker_response_timeout_minutes`, default 120 minutes) already exists in the tool — this only needed correct config placement, not a new convention.

## Progress Log

### 2026-09-11
- PRD created following a multi-session discussion (originating in the `choose-your-ai-adventure` repo's PRD #5) about adopting Viktor Farcic's `dot-agent-deck` orchestration.
- Decided to model this repo's config on `dot-ai`'s actual usage rather than `dot-agent-deck`'s own mixed-vendor dogfooding demo, pending Milestone 0's final call.
- Decided Milestone 0 is a single upfront design milestone (not a repeated step 0 on every milestone), with later milestones each opening with a step that reads Milestone 0's output — chosen because the open decisions (role set, vendor mix, notification channel, devbox scripts) are all decidable now, in one sitting, rather than surfacing fresh at each later milestone.

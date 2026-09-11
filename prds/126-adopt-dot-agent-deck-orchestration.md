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

- **Tool**: `dot-agent-deck`, installed via `brew install dot-agent-deck`. Infrastructure (a Rust daemon + TUI), not a prompt or skill — it owns process lifecycle, message delivery, and idle detection.
- **Config location**: `.dot-agent-deck.toml` at this repo's root, per-project — matching how Viktor's own `dot-ai` and `dot-ai-infra` each carry their own config rather than a shared central one.
- **Devbox scripts**: each role invokes `devbox run <script>` (e.g. `agent-coder`, `agent-tester`); this repo has no `devbox.json` today, so the scripts need to be defined from scratch, not copied from an existing setup.
- **Escalation model**: two user gates only — test-plan approval before delegation begins, and merge confirmation at the end. Everything between runs unattended.
- **Notification channel**: Viktor's config notifies via Telegram at four moments (escalation, merge gate, run finished, worker-stuck). This repo has no existing Telegram integration — Milestone 0 must decide the replacement channel.

## Success Criteria

- `dot-agent-deck` is installed and its daemon/TUI runs against this repo without error.
- A `.dot-agent-deck.toml` exists at the repo root defining every role decided in Milestone 0, each backed by a working devbox script.
- The orchestrator's prompt correctly reads this repo's `prds/[id]-*.md` files and produces a test-plan table Whitney can approve — verified on a dry run before touching PRD #125.
- PRD #125 (auto-adjusting posting cadence) is successfully implemented end to end through the deck, from test-plan approval through merge confirmation.
- The two-gate model holds in practice: no role notifies or blocks on Whitney outside the test-plan and merge gates.

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Design decisions (role set, vendor mix, notification channel) get made ad hoc mid-implementation instead of settled upfront, producing a config that has to be reworked | High | Milestone 0 exists specifically to settle these with Whitney before any config is written; every later milestone opens with a step reading Milestone 0's Decision Log entries. |
| Mixed-vendor roles (if chosen) require installing and maintaining CLIs for other vendors (codex, pi, opencode), which is real ongoing infrastructure cost | Medium | Milestone 0 explicitly weighs this cost against `dot-ai`'s actual same-vendor pattern before committing either way. |
| Running PRD #125 as the first real workload risks compounding a deck misconfiguration with a real feature's complexity | Medium | The dry-run milestone (a low-stakes task) must pass before PRD #125 is attempted. |
| Cost per run is unmeasured — every role potentially running at high reasoning effort on a frontier model is not free | Medium | No existing cost instrument is assumed. Flagged as an open question below rather than silently ignored. |

## Dependencies

**None** — self-contained tooling addition. Does not block or depend on any other open PRD in this repo.

## Design Notes

- The feature PR created by `/prd-done` needs the `run-acceptance` label to trigger acceptance gate CI. This is handled automatically by `/prd-done` when acceptance gate tests are detected.

## Decision Log

*(Populated as Milestone 0 and later milestones make real decisions. The Context subsection under Solution Overview above is prior research, not yet a decision.)*

## Milestones

- [ ] **Milestone 0 — Final design decisions made with Whitney, PRD updated.** Whitney and the implementing agent work through, and record as Decision Log entries: (a) the role set — adopt `dot-ai`'s seven roles (including `documenter`) or the base six; (b) the vendor/harness per role — same-vendor Claude throughout (matching `dot-ai`'s actual usage) or a deliberate mixed-vendor split (matching the `mixed` preset in `dot-agent-deck`'s own dogfooding config), with the cost and CLI-maintenance tradeoff stated explicitly either way; (c) the concrete devbox script each role invokes; (d) the notification channel replacing Viktor's Telegram integration for the four notify moments (escalation, merge gate, run finished, worker-stuck); (e) the specific low-stakes task the dry-run milestone below will use — name it now rather than leaving it for whoever runs that milestone to pick. This milestone's output is Decision Log rows plus any resulting edits to the milestones below — do not proceed to Milestone 1 until these are recorded.
- [ ] **`dot-agent-deck` and devbox installed.** Step 0: Read Milestone 0's Decision Log entries. Install `dot-agent-deck` via Homebrew and devbox; create `devbox.json` with the scripts decided in Milestone 0(c). Confirm the daemon starts and the TUI attaches against this repo with no roles configured yet.
- [ ] **`.dot-agent-deck.toml` written.** Step 0: Read Milestone 0's Decision Log entries. Define the modes/panes and `[[orchestrations.roles]]` for every role decided in Milestone 0(a)/(b), each pointing at its devbox script from the previous milestone. For every role's `prompt_template`, adapt it from Viktor's original wherever it references repo-specific conventions that differ here (e.g., PRD file locations, test commands, terminology) — do not copy a role's prompt verbatim where this repo's conventions diverge from his.
- [ ] **Orchestrator prompt adapted to this repo.** Step 0: Read Milestone 0's Decision Log entries and the previous two milestones' output. Rewrite the orchestrator's `prompt_template` to read this repo's actual `prds/[id]-*.md` files and produce a test-plan table matching this repo's own test tiers (`npm run` scripts, `.claude/verify.json`'s `acceptance_test`), not Viktor's original L1/L2/chain-smoke terminology, which does not exist in this repo.
- [ ] **Dry run validated on a low-stakes task.** Step 0: Read the three previous milestones' output. Run the full deck — test-plan gate through merge gate — on the low-stakes task named in Milestone 0(e) (not PRD #125) to confirm the two-gate model and role handoffs work before a real feature depends on it. Fix any config or prompt issues found before proceeding.
- [ ] **PRD #125 implemented through the deck.** Step 0: Read the dry-run milestone's output — do not attempt this until the dry run passed cleanly. Run PRD #125 (auto-adjusting posting cadence) end to end through the deck: test-plan approval, delegated implementation/test/review/audit, and merge confirmation.
- [ ] **Setup documented.** Write a new `docs/dot-agent-deck.md` covering what was installed, the final `.dot-agent-deck.toml` role set, and how to invoke the deck for a future PRD, so this doesn't need to be reconstructed from git history next time.

## Implementation Plan

### Phase 1: Design
- Milestone 0

### Phase 2: Infrastructure
- Install `dot-agent-deck` and devbox
- Write `.dot-agent-deck.toml`
- Adapt the orchestrator prompt

### Phase 3: Validation
- Dry run
- PRD #125 through the deck
- Documentation

## Open Questions

- What replaces Telegram for the four notification moments? Not resolved by prior research — Milestone 0 must decide.
- Is there any cost instrument to track spend across a multi-role run before this is adopted for real work, or is that accepted as unmeasured for now?
- If PRD #125's dry run or real run surfaces a stuck-worker case, what should the 120-minute-idle equivalent behavior be here, given there's no existing daemon-timeout convention in this repo?

## Progress Log

### 2026-09-11
- PRD created following a multi-session discussion (originating in the `choose-your-ai-adventure` repo's PRD #5) about adopting Viktor Farcic's `dot-agent-deck` orchestration.
- Decided to model this repo's config on `dot-ai`'s actual usage rather than `dot-agent-deck`'s own mixed-vendor dogfooding demo, pending Milestone 0's final call.
- Decided Milestone 0 is a single upfront design milestone (not a repeated step 0 on every milestone), with later milestones each opening with a step that reads Milestone 0's output — chosen because the open decisions (role set, vendor mix, notification channel, devbox scripts) are all decidable now, in one sitting, rather than surfacing fresh at each later milestone.

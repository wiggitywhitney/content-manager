# Research: devbox (Jetify) Install and Custom Scripts

**Project:** content-manager
**Last Updated:** 2026-09-18

## Update Log
| Date | Summary |
|------|---------|
| 2026-09-18 | Initial research |

## Findings

### Summary
There is no `brew install` command for devbox — neither the assumed `jetpack-io/devbox/devbox` nor a `jetify-com/devbox/devbox` tap exists. The canonical install is a curl script. Devbox is Nix-based and auto-installs Nix itself if missing — no separate Nix step needed. Custom scripts go under `shell.scripts` in `devbox.json` and are invoked with `devbox run <name>`.

### Surprises & Gotchas
- **Homebrew isn't just a renamed tap — it isn't a supported install path at all.** An open GitHub feature request titled "install via homebrew" (opened 2022) is still unresolved: "brew install devbox" as the ask, still open. 🟢 ([Issue #76](https://github.com/jetify-com/devbox/issues/76))
- **Devbox auto-installs Nix — never install Nix yourself.** "If Nix is not detected when running a command, Devbox will automatically install it for you." Per-OS: multi-user mode on macOS, single-user on Linux and WSL2, "if not already present." 🟢 ([Installing Devbox](https://www.jetify.com/docs/devbox/installing-devbox))
- **Open bug**: sourcing a helper script from `init_hook` and then running a `devbox run` script can throw "file not found" — workaround is `bash script.sh` instead of `source script.sh`. 🟡 ([Issue #2108](https://github.com/jetify-com/devbox/issues/2108), [Issue #2607](https://github.com/jetify-com/devbox/issues/2607))
- No comprehensive 2026 breaking-changes list was found; the `devbox.json` `$schema` field/URL is versioned and evolving (referenced in Jetify's devlog), so check it at implementation time rather than hardcoding an old version. 🟡

### Findings

**1. Install command** 🟢 high confidence
```bash
curl -fsSL https://get.jetify.com/devbox | bash
```
No brew tap of any name is documented. ([jetify-com/devbox README](https://github.com/jetify-com/devbox), [Installing Devbox](https://www.jetify.com/docs/devbox/installing-devbox))

**2. devbox.json custom-scripts schema** 🟢 high confidence
Scripts live under `shell.scripts`, each value a string or array of command strings:
```json
{
  "packages": ["nodejs@latest"],
  "shell": {
    "init_hook": ["echo setting up"],
    "scripts": {
      "agent-orchestrator": "claude --agent orchestrator",
      "agent-coder": "claude --agent coder",
      "agent-reviewer": "claude --agent reviewer",
      "agent-auditor": "claude --agent auditor",
      "agent-tester": "claude --agent tester",
      "agent-release": "claude --agent release",
      "agent-documenter": "claude --agent documenter"
    }
  }
}
```
Invoke from the shell as `devbox run agent-orchestrator`, etc. **Source says:** "Scripts can be added in your devbox.json, and require a unique name, and a command or list of commands to run" and "Scripts started with devbox run are launched in an interactive devbox shell that terminates once the script finishes." ([Running Scripts](https://www.jetify.com/docs/devbox/guides/scripts))

**3. 2026 breaking changes** 🟡 medium confidence
No dedicated changelog/migration page was found; only one concrete regression (init_hook sourcing bug above) was verified via GitHub issues. Devlog references ongoing JSON-schema evolution. ([Devlog #14](https://www.jetify.com/blog/devlog/this-week-14-json-schemas-devbox-0-8-3-and-non-default-outputs/))

**4. Nix prerequisite** 🟢 high confidence
Not a separate manual step — Devbox auto-installs Nix on first `devbox shell`/`devbox run`.

### Recommendation
Install via the curl script, not brew — brew is not an option for devbox. Skip any Nix setup step; devbox handles it on first run. Define the 7 `agent-<role>` scripts directly under `shell.scripts` as shown above; avoid `source`-ing helper scripts from `init_hook` given the open bug — use `bash` instead of `source` for anything that must run scripts.

### Caveats
- The devbox.json JSON Schema file itself wasn't fetched in this session — verify the exact `$schema` version string at implementation time (`https://raw.githubusercontent.com/jetify-com/devbox/<version>/.schema/devbox.schema.json`).
- Only one concrete regression was verified via GitHub issues; "2026 breaking changes" is not comprehensively answered.

## Sources
- [jetify-com/devbox GitHub README](https://github.com/jetify-com/devbox) — install command, no brew option
- [Installing Devbox — Jetify Docs](https://www.jetify.com/docs/devbox/installing-devbox) — install command, Nix auto-install per OS
- [Running Scripts — Jetify Docs](https://www.jetify.com/docs/devbox/guides/scripts) — devbox.json scripts schema, `devbox run` behavior
- [Issue #76 — install via homebrew](https://github.com/jetify-com/devbox/issues/76) — confirms no brew support, open since 2022
- [Issue #2108](https://github.com/jetify-com/devbox/issues/2108) / [Issue #2607](https://github.com/jetify-com/devbox/issues/2607) — init_hook sourcing bug affecting `devbox run`
- [Devlog #14 — JSON schemas, Devbox 0.8.3](https://www.jetify.com/blog/devlog/this-week-14-json-schemas-devbox-0-8-3-and-non-default-outputs/) — schema evolution note

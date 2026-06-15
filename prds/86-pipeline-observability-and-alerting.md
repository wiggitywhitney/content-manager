# PRD #86: Pipeline Observability and Alerting

## Problem

Two silent failure modes exist in the daily content pipeline:

1. **Partial post failure**: `post-social-content.js` exits 0 even when individual platform posts fail (LinkedIn, Bluesky, Mastodon). The script logs `[social] Failed to post row N to LinkedIn` at error level and marks the Google Sheet row as `failed`, but the GitHub Actions workflow shows green and sends no notification.

2. **Silent token expiry**: The LinkedIn OAuth token expires every 60 days. `post-linkedin.js` already reads `LINKEDIN_TOKEN_EXPIRES_AT` and logs a warning, but the warning threshold is too low — it fires after the token has already expired, not before.

Both failure modes are invisible until Whitney manually notices that posts stopped appearing.

## Solution

Make both failure modes visible and alerting using Datadog:

- Exit non-zero from `post-social-content.js` when any platform post fails, so the GitHub Actions step turns red
- Emit a `content_manager.linkedin.token_days_until_expiry` gauge metric from `post-linkedin.js` after each run
- Enable Datadog CI Visibility for the pipeline via the GitHub App (no workflow changes required)
- Enable Datadog job log forwarding (toggle in Datadog UI — no workflow changes required)
- Create a log-based monitor that alerts when `[social] Failed to post` appears in forwarded logs
- Create a metric monitor that alerts when the token expiry countdown drops below 21 days
- Build a simple Datadog dashboard showing pipeline health and token countdown

## Background

This PRD was preceded by a research spike (completed before M1 began) that verified current Datadog API formats, CI Visibility setup mechanics, and log monitor query syntax. Key research finding: CI Visibility for GitHub Actions requires **zero workflow YAML changes** — it uses a GitHub App webhook, not a `datadog-ci` action step.

Research saved at: [`docs/research/datadog-ci-observability.md`](../docs/research/datadog-ci-observability.md)

## Relevant Code

- `src/post-social-content.js` — sets `status = 'failed'` in sheet but exits 0; this is where partial failure detection lives
- `src/post-linkedin.js` — reads `LINKEDIN_TOKEN_EXPIRES_AT`, logs warning; this is where the metric emission goes
- `.github/workflows/daily-sync.yml` — the GitHub Actions workflow; CI Visibility is enabled at the Datadog UI level, but a `DD_API_KEY` secret must be added here for metric submission
- `.vals.yaml` — secrets injection; `DD_API_KEY` must be added pointing to a GSM secret

## Success Criteria

- A failed platform post causes the GitHub Actions workflow step to show red
- A Datadog log-based monitor fires within 5 minutes of a failed post
- The LinkedIn token expiry metric appears in Datadog and updates on every daily run
- A Datadog metric monitor fires when the token has fewer than 21 days remaining
- A Datadog dashboard shows pipeline run history and token countdown

## Milestones

- [x] M0: Research — Datadog CI Visibility, log forwarding, custom metrics API, monitor creation (completed; see [`docs/research/datadog-ci-observability.md`](../docs/research/datadog-ci-observability.md))
- [x] M1: Exit non-zero on partial platform failure
- [x] M2: Emit LinkedIn token expiry metric and lower warning threshold
- [x] M3: Enable Datadog CI Visibility and job log forwarding
- [x] M4: Create Datadog monitors (log-based + metric)
- [x] M5: Create Datadog dashboard

---

## Milestone Detail

### M1: Exit non-zero on partial platform failure

**Step 0:** Read [`docs/research/datadog-ci-observability.md`](../docs/research/datadog-ci-observability.md) — the research file gates this milestone. Pay attention to the finding that CI Visibility tracks the exit code, so this change is the prerequisite for M3 and M4 to be meaningful.

**What to implement:**

In `src/post-social-content.js`, track whether any platform post failed during the run. After all rows are processed, if any platform returned an error, exit with code 1. The current behavior sets `status = 'failed'` in the Google Sheet correctly — the only change is the process exit behavior.

The DRY_RUN path must not change: dry runs must always exit 0 regardless of simulated failures.

**Tests:**

Write failing tests first. The test suite must cover:
- All platforms succeed → exits 0
- One platform fails, others succeed → exits 1 (partial failure)
- All platforms fail → exits 1
- DRY_RUN=true with simulated failures → exits 0

Use a boolean flag (e.g., `let hadFailure = false`) set to `true` when any platform's post function returns an error or throws. Check this flag after the full row-processing loop completes, then call `process.exit(1)` as the very last statement in the script.

Do NOT call `process.exit(1)` inside the per-row processing loop — only after all rows have been processed and all Google Sheet status writes have completed.
Do NOT add any new npm dependencies for failure tracking.
Do NOT modify the Google Sheet status-writing behavior — that already works correctly.

The test framework is Vitest. Tests live in the `test/` directory. Read existing test files before adding new ones to match their import style and mock patterns.

Run `npm test` to verify all tests pass before marking this milestone complete.

**Why this matters:** Without a non-zero exit, CI Visibility sees every run as green, log-based monitors have nothing actionable to fire on, and GitHub sends no notification. This is the foundation that makes M3 and M4 useful.

---

### M2: Emit LinkedIn token expiry metric and lower warning threshold

**Step 0:** Read [`docs/research/datadog-ci-observability.md`](../docs/research/datadog-ci-observability.md) — specifically the "Custom Metric Submission" section for the exact endpoint, payload format, and metric type code (type 3 = gauge). The research recommends a direct HTTP POST from Node.js rather than the `masci/datadog@v2` third-party Action.

**What to implement:**

In `src/post-linkedin.js`:

1. Lower the warning threshold from "already expired" to 21 days. The existing warning log line that fires after expiry should instead fire when `daysUntilExpiry < 21`.

2. Add a `submitTokenExpiryMetric(daysUntilExpiry)` helper that POSTs a gauge metric to Datadog:
   - Metric name: `content_manager.linkedin.token_days_until_expiry`
   - Type: gauge (type code `3` in v2 API)
   - Endpoint: `POST https://api.datadoghq.com/api/v2/series`
   - Auth header: `DD-API-KEY: <value of process.env.DD_API_KEY>`
   - Tags: `["service:content-manager"]`
   - Call this function at the end of the token expiry check, regardless of whether a warning was logged

3. The metric submission must be a no-op (skip silently) when `DD_API_KEY` is not set in the environment, so local runs without the secret do not fail.

Read `src/post-linkedin.js` before writing any code — find the existing block that reads `process.env.LINKEDIN_TOKEN_EXPIRES_AT` and computes days-remaining. Modify that block in place; do not add a parallel or duplicate expiry check.

Do NOT use any npm packages for the HTTP POST — use Node's built-in `fetch` (available since Node 18, which this project requires).
Do NOT add any new npm dependencies.
Do NOT modify any code outside `src/post-linkedin.js` for this milestone.

The test framework is Vitest. Tests live in the `test/` directory. Read existing test files before adding new ones to match their import style and mock patterns. Mock the `fetch` call; do not make real Datadog API calls in unit tests.

**Secrets setup (Updated per Decisions 4 and 5):**

- `DD_API_KEY` and `DD_APP_KEY` are already in `.vals.yaml`, pointing to existing GSM secrets `datadog-commit-story-dev` and `datadog-commit-story-app` respectively — no new GSM secrets needed
- `DD_API_KEY` is fetched from GSM at runtime in `daily-sync.yml` alongside the LinkedIn credentials — no GitHub Actions secret needed

**Tests:**

Write failing tests first:
- Warning logs fire when `daysUntilExpiry < 21`, not only after expiry
- `submitTokenExpiryMetric` is called with the correct value on each run
- Metric submission is skipped (no error thrown) when `DD_API_KEY` is absent
- Mock the HTTP POST; do not make real API calls in unit tests

Run `npm test` to verify all tests pass before marking this milestone complete.

---

### M3: Enable Datadog CI Visibility and job log forwarding

**Step 0:** Read [`docs/research/datadog-ci-observability.md`](../docs/research/datadog-ci-observability.md) — specifically the "CI Visibility Setup (GitHub App approach)" section. The critical finding is that this requires **zero workflow YAML changes** — it is entirely configured in the Datadog UI.

**What to implement (manual UI steps — no code changes):**

1. In Datadog: navigate to **Software Delivery → CI Visibility → Add a Pipeline Provider → GitHub**
2. Click **Enable Account** → **Create GitHub App** → grant `Actions: Read Only` permission → name it "Datadog CI Visibility"
3. Install the GitHub App on the `wiggitywhitney/content-manager` repo in GitHub
4. Toggle **Enable CI Visibility** for the content-manager repo
5. Toggle **Enable Job Logs Collection** for the content-manager repo

**Verification:**

After the next daily-sync run (or trigger it manually via GitHub Actions UI), confirm in Datadog:
- The run appears in **Software Delivery → CI Visibility → Pipelines**
- Logs appear in **Logs** with `source:github` and `datadog.product:cipipeline` tags
- Search `source:github "content-manager"` in Log Explorer and confirm workflow logs are present

**Note on billing:** CI Visibility is per-committer; job log forwarding is billed separately per log volume. Both should be negligible for a solo personal pipeline but worth verifying in the Datadog billing estimate before enabling.

---

### M4: Create Datadog monitors

**Step 0:** Read [`docs/research/datadog-ci-observability.md`](../docs/research/datadog-ci-observability.md) — specifically the "Log-Based Monitor Creation" and "Metric Monitor for Token Expiry Countdown" sections for the exact API payload shapes and gotchas (Flex Tier logs not supported, unscoped app key with `logs_read_data` required, monitor threshold direction for metric alert).

**Prerequisite:** M3 is complete and log forwarding is verified (57 log entries confirmed in Datadog Log Explorer on 2026-06-15 from run #27571718423). M2 is complete. The log query and metric monitor can both be validated immediately — no need to wait for another run.

**Credentials (Updated per Decision 4):** Both `DD_API_KEY` and `DD_APP_KEY` are already in `.vals.yaml`. When calling the Datadog Monitors API, use `DD_API_KEY` for the `DD-API-KEY` header and `DD_APP_KEY` for the `DD-APPLICATION-KEY` header.

**What to implement:**

Create both monitors via the Datadog UI first (use the "Create Monitor" flow to preview the query live before committing), then verify they work. After validation, optionally export the monitor JSON for version-controlled reference.

**Monitor 1 — Partial post failure (log alert):**
- Type: Log Alert
- Search query: `source:github "Failed to post"`
- Evaluate over: last 5 minutes
- Alert when count is above 0
- Message: `One or more social platform posts failed during the daily-sync run. Check GitHub Actions logs for details: https://github.com/wiggitywhitney/content-manager/actions`
- Tags: `service:content-manager`
- Notify: Leave the notification field empty when creating the monitor — Whitney will configure the notification channel manually after verifying the monitor fires correctly.

**Monitor 2 — LinkedIn token expiry (metric alert):**
- Type: Metric Alert
- Query: `avg(last_1h):avg:content_manager.linkedin.token_days_until_expiry{*} < 21`
- Warning threshold: 30 days
- Critical threshold: 21 days
- Notify no data: true (if the metric stops reporting, the token may have expired)
- Message: (Updated per Decisions 6 and 7)
  ```text
  LinkedIn OAuth token expires in {{value}} days. Refresh it with these steps:

  1. Run: vals exec -f .vals.yaml -- node src/linkedin-oauth-setup.js
  2. Complete the LinkedIn authorization in the browser that opens
  3. Copy and run the three "gcloud secrets versions add" commands the script outputs
     (updates linkedin_access_token, linkedin_token_expires_at, linkedin_person_urn in GSM)
  4. Clear your terminal history immediately after — the token appears in plaintext
     zsh: fc -p   bash: history -c

  CI reads credentials from GSM at runtime — no GitHub Actions secrets to update.
  The next daily run will use the new token automatically.
  ```
- Tags: `service:content-manager`
- Notify: Both work email AND wiggitywhitney personal email (Decision 6)

**Verification:** Confirm both monitors appear in the Datadog Monitors list and show status "OK" (or "No Data" for the metric monitor until M2 produces its first data point).

---

### M5: Create Datadog dashboard

**Step 0:** Read [`docs/research/datadog-ci-observability.md`](../docs/research/datadog-ci-observability.md) for the log query tags and metric name to use in dashboard widgets.

**Prerequisite:** M3 and M4 must be complete — the dashboard queries CI Visibility data, forwarded logs, and the token expiry metric.

**What to implement (Datadog UI — no code changes):**

Create a dashboard titled "Content Manager Pipeline Health" with these widgets:

1. **Pipeline status over time** — CI Visibility query: `@ci.pipeline.name:"Daily Content Sync" @git.repository.id_v2:"github.com/wiggitywhitney/content-manager"`, grouped by day, showing pass/fail counts. Use a bar or timeseries widget. (Note: the pipeline name comes from the `name:` field in the GitHub Actions YAML — `"Daily Content Sync"` — not the filename `daily-sync`.)

2. **Log error count by day** — Log query: `source:github "Failed to post"`, aggregated by day. Use a timeseries widget.

3. **LinkedIn token expiry countdown** — Metric: `avg:content_manager.linkedin.token_days_until_expiry{*}`. Use a query value widget showing the current value with color thresholds: green ≥ 30 days, yellow 21–29 days, red < 21 days.

4. **Recent failure log stream** — Live tail log widget filtered to `source:github "Failed to post"`, showing the last 10 matches with timestamp and message.

**Verification:** Confirm the dashboard loads with data in each widget (some widgets may show "No Data" until the next daily run fires).

---

## Design Notes

- **One PRD over two issues:** The exit code fix (M1) and the Datadog monitoring layer (M3–M5) are causally linked — shipping M1 without M3–M4 leaves a non-zero exit with no richer alerting than GitHub's default email. Bundling them ensures the full observability story ships together.
- **GitHub App approach, not datadog-ci action:** Research confirmed CI Visibility uses a webhook-based GitHub App — no `DD_API_KEY` in workflow YAML, no datadog-ci CLI steps. Training data commonly shows the CLI approach; do not follow it.
- **Direct HTTP POST for metrics, not masci/datadog@v2:** The `masci/datadog` action is third-party. For a personal pipeline, a direct `fetch` call from the existing Node.js script is simpler, auditable, and avoids supply-chain risk.
- **Monitors created in Datadog UI first:** The UI provides a live query preview that validates syntax before committing. After validation, the JSON can optionally be version-controlled for reference, but Datadog UI is the source of truth.
- **The feature PR created by `/prd-done` needs the `run-acceptance` label to trigger acceptance gate CI. This is handled automatically by `/prd-done` when acceptance gate tests are detected.**

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-15 | One PRD over two issues | Exit code fix and monitoring layer are causally linked; shipping the fix alone leaves a silent gap |
| 2026-06-15 | CI Visibility via GitHub App (no workflow changes) | Research confirmed this is the current approach; datadog-ci CLI in workflow is outdated |
| 2026-06-15 | Metric emitted via direct HTTP POST from Node.js | Avoids third-party Action dependency; simpler for a solo personal pipeline |
| 2026-06-15 | Monitors created in Datadog UI first, then optionally exported | UI provides live query validation; safer than deploying untested monitor API payloads |
| 2026-06-15 | Reuse existing GSM secrets for Datadog credentials | `datadog-commit-story-dev` (DD_API_KEY) and `datadog-commit-story-app` (DD_APP_KEY) already exist in demoo-ooclock GSM from the commit-story project — no new secrets needed. Both are now in `.vals.yaml`. |
| 2026-06-15 | Fetch DD_API_KEY from GSM at runtime in CI, not via GitHub Actions secret | The existing service account already fetches LinkedIn credentials from GSM at runtime in the "Read credentials from GSM" step. DD_API_KEY follows the same pattern — no manual GitHub Actions secret needed. |
| 2026-06-15 | Both monitors notify work email AND wiggitywhitney personal email | Whitney wants the alert to reach both addresses so it's visible whether she's at work or not. The "Notify" field in Datadog supports multiple email recipients. |
| 2026-06-15 | LinkedIn token refresh runbook included in M4 monitor message | The monitor alert message should contain the complete step-by-step refresh instructions so Whitney can act immediately when the alert fires without hunting for docs. Key steps: run `vals exec -f .vals.yaml -- node src/linkedin-oauth-setup.js`, complete browser OAuth, run the three `gcloud secrets versions add` commands the script outputs, clear terminal history. CI reads from GSM at runtime so no GitHub Actions secrets need updating after GSM is updated. |
| 2026-06-15 | Datadog CI pipeline name is the workflow `name:` field, not the filename | The CI Visibility pipeline name comes from `name: Daily Content Sync` in the GitHub Actions YAML, not from the filename `daily-sync.yml`. The dashboard widget 1 query must use `@ci.pipeline.name:"Daily Content Sync"` (with quotes because of the space). Using the filename produces zero results with no error. |

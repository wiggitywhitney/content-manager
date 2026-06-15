# Research: Datadog CI Observability for GitHub Actions

**Project:** content-manager
**Last Updated:** 2026-06-15

## Update Log
| Date | Summary |
|------|---------|
| 2026-06-15 | Initial research — CI Visibility, log forwarding, custom metrics, log-based monitors |

## Findings

### Summary

Setting up Datadog CI Visibility for a GitHub Actions repo requires **no workflow YAML changes** — it is entirely configured through a GitHub App installed via the Datadog UI. Job log forwarding is also a toggle in the same UI. Custom metrics without the Agent are best submitted via `POST /api/v2/series` from the Node.js script (no third-party Action needed). Log-based monitors evaluate only Standard Tier indexed logs; the log query uses Log Explorer syntax.

---

### Surprises & Gotchas

**🟢 CI Visibility requires ZERO workflow changes.** Training data commonly shows `datadog-ci` CLI steps in workflow YAML. The current docs describe a GitHub App webhook approach — you create a GitHub App in the Datadog UI, install it on the repo, and toggle CI Visibility on per-account or per-repository. Pipelines appear immediately with no `DD_API_KEY` secret, no workflow file modifications.

**Source says:** "Pipelines appear immediately after enabling CI Visibility for any account or repository." ([GitHub Actions Setup for CI Visibility](https://docs.datadoghq.com/continuous_integration/pipelines/github/))
**Interpretation:** This is fully webhook-based — GitHub sends workflow events to Datadog via the App. No agent or CLI in the workflow.

**🟢 Job log forwarding is also a toggle, no workflow changes.** Once CI Visibility is enabled, flipping "Enable Job Logs Collection" immediately starts forwarding all workflow job logs to Datadog Log Management. Logs are tagged `source:github` and `datadog.product:cipipeline`.

**Source says:** "Immediately after toggling logs collection, workflow job logs are forwarded to Datadog Log Management." ([GitHub Actions Setup for CI Visibility](https://docs.datadoghq.com/continuous_integration/pipelines/github/))

**🔴 CI Visibility will NOT detect partial failures.** CI Visibility tracks `@ci.status` which follows the workflow/job exit code. If `post-social-content.js` exits 0 even when a platform post fails, CI Visibility sees the run as green. A log-based monitor watching for `[social] Failed to post` in the forwarded logs is the correct tool.

**🟡 Log-based monitors only evaluate Standard Tier indexed logs.** Flex Tier logs are explicitly not supported for monitors.

**Source says:** "Flex Tier logs...are not supported for monitors." ([Datadog Log Monitor docs](https://docs.datadoghq.com/monitors/types/log/))
**Interpretation:** Ensure the GitHub log index is Standard Tier (it is by default unless you've configured Flex routing).

**🟡 `masci/datadog@v2` is third-party, not official Datadog.** It works, but for a personal pipeline the simpler and more auditable approach is a direct `curl` or `fetch` call to the Datadog HTTP API — no additional Action dependency.

---

### Findings

#### 1. CI Visibility Setup (GitHub App approach)

🟢 **High confidence** — verified against official docs.

Setup steps (all in Datadog UI, no workflow changes):
1. Navigate to **Software Delivery → CI Visibility → Add a Pipeline Provider → GitHub**
2. Click **Enable Account** → **Create GitHub App** → grant `Actions: Read Only` permission
3. Install the GitHub App on the target repo in GitHub
4. Toggle **Enable CI Visibility** per-account or per-repo
5. Toggle **Enable Job Logs Collection** to forward workflow logs

**Required secrets in the repo:** None.
**Required changes to workflow YAML:** None.
**Data available:** Pipeline status, duration, job-level breakdown, log streams.

#### 2. Log Forwarding and Query

🟢 **High confidence** — verified against official docs.

Forwarded logs are queryable in Log Explorer with:
- `source:github` — all GitHub Actions workflow logs
- `datadog.product:cipipeline` — CI pipeline logs specifically
- `[social] Failed to post` — message content search (Log Explorer full-text)

Log monitor query format (Log Explorer syntax):
```text
source:github "Failed to post"
```

Log alert type in Monitor API:
```json
{
  "type": "log alert",
  "query": "logs(\"source:github \\\"Failed to post\\\"\").index(\"*\").rollup(\"count\").last(\"5m\") > 0"
}
```

Limit: maximum 2-day rolling window; 1,000 log monitors per account.

#### 3. Custom Metric Submission (without Agent)

🟡 **Medium confidence** — endpoint verified, exact type code from API reference.

**Endpoint:** `POST https://api.datadoghq.com/api/v2/series`
**Auth header:** `DD-API-KEY: <key>`
**Payload:**
```json
{
  "series": [{
    "metric": "content_manager.linkedin.token_days_until_expiry",
    "type": 3,
    "points": [{"timestamp": 1234567890, "value": 25.0}],
    "tags": ["service:content-manager", "env:prod"]
  }]
}
```
Type codes in v2 API: `0` = unspecified, `1` = count, `2` = rate, `3` = gauge.

**Best approach for this project:** Add a `submitMetric(name, value, tags)` helper to `src/post-linkedin.js` that POSTs directly to `/api/v2/series` using Node's `fetch`. No additional GitHub Action or npm dependency needed — only requires `DD_API_KEY` in GitHub Secrets and `.vals.yaml`.

Alternative: `masci/datadog@v2` GitHub Action (latest `v2.0.3`) — third-party, YAML-as-string syntax, supports both metrics and logs in one step. Convenient but adds a supply-chain dependency for a personal pipeline.

#### 4. Log-Based Monitor Creation

🟡 **Medium confidence** — endpoint verified; exact options schema should be confirmed in Datadog UI "Create Monitor" JSON preview before implementing.

**Endpoint:** `POST https://api.datadoghq.com/api/v1/monitor`
**Auth:** `DD-API-KEY` + `DD-APPLICATION-KEY` (unscoped app key with `logs_read_data` permission)

```json
{
  "name": "content-manager: partial post failure",
  "type": "log alert",
  "query": "logs(\"source:github \\\"Failed to post\\\"\").index(\"*\").rollup(\"count\").last(\"5m\") > 0",
  "message": "One or more social platforms failed to post. Check GitHub Actions logs for details. @<notification-channel>",
  "tags": ["service:content-manager"],
  "options": {
    "thresholds": { "critical": 0 },
    "notify_no_data": false,
    "renotify_interval": 0
  }
}
```

#### 5. Metric Monitor for Token Expiry Countdown

🟡 **Medium confidence** — standard metric monitor format, verified pattern.

```json
{
  "name": "content-manager: LinkedIn token expiry warning",
  "type": "metric alert",
  "query": "avg(last_1h):avg:content_manager.linkedin.token_days_until_expiry{*} < 21",
  "message": "LinkedIn OAuth token expires in {{value}} days. Refresh at https://github.com/wiggitywhitney/content-manager. @<notification-channel>",
  "tags": ["service:content-manager"],
  "options": {
    "thresholds": { "critical": 21, "warning": 30 },
    "notify_no_data": true,
    "no_data_timeframe": 2
  }
}
```

**Important:** The `query` comparator is `< 21` and the threshold is `critical: 21`. The monitor fires when days-remaining drops below the threshold.

---

### Recommendation

For the content-manager pipeline observability PRD, implement in this order:

1. **Exit non-zero from `post-social-content.js`** when any platform fails — prerequisite for everything else
2. **Enable CI Visibility + Job Log Collection** via Datadog UI (no workflow changes) — gives pipeline dashboard + log forwarding
3. **Emit `content_manager.linkedin.token_days_until_expiry` metric** from `post-linkedin.js` via direct HTTP POST — requires `DD_API_KEY` added to GitHub Secrets and `.vals.yaml`
4. **Create log-based monitor** watching for `Failed to post` in `source:github` logs — catches partial failures
5. **Create metric monitor** watching `content_manager.linkedin.token_days_until_expiry < 21` — proactive token expiry warning
6. **Optional dashboard** — token countdown + post history by platform

### Caveats

- The exact log monitor query syntax (escaping, `.index()`, `.rollup()`) should be validated in the Datadog Monitor UI before deploying via API — the UI shows a live preview.
- The `DD_API_KEY` secret will need to be added to both GitHub Secrets (for live runs) and the local `.vals.yaml` (for dry-run testing). It is already used in Datadog's own tooling — check whether it already exists in GSM under a different name before creating a new secret.
- CI Visibility is billed per committer (check current Datadog pricing for personal accounts — may be free or low-cost for solo repos).
- Log forwarding is billed separately from CI Visibility — check retention settings in Log Management to avoid unexpected storage costs.

## Sources
- [GitHub Actions Setup for CI Visibility](https://docs.datadoghq.com/continuous_integration/pipelines/github/) — primary source for GitHub App setup and log forwarding
- [Datadog Logs API](https://docs.datadoghq.com/api/latest/logs/) — log intake endpoint
- [Datadog Metrics API](https://docs.datadoghq.com/api/latest/metrics/) — v2/series endpoint and type codes
- [masci/datadog GitHub Action](https://github.com/marketplace/actions/datadog-action) — third-party Action for metrics/logs from CI
- [Datadog Log Monitor docs](https://docs.datadoghq.com/monitors/types/log/) — log alert query syntax, limitations (Flex Tier exclusion, 2-day window, 1000 monitor limit)
- [Datadog Monitors API](https://docs.datadoghq.com/api/latest/monitors/) — monitor creation endpoint

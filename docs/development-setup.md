# Development Setup

This document covers local development setup and common workflows for the content-manager project.

## Prerequisites

- Node.js >= 18.0.0
- [vals](https://github.com/helmfile/vals) for local secret management
- Google Cloud project with Secret Manager enabled (`gcloud auth application-default login`)
- Access to the content tracking spreadsheets

Install vals:

```bash
brew install helmfile/tap/vals
```

## Secret Management with vals

This project uses [vals](https://github.com/helmfile/vals) to inject secrets from Google Secret Manager at runtime. Secrets are never stored in files or exported to your shell profile.

### Configuration

Secrets are configured in `.vals.yaml` at the project root:

```yaml
GOOGLE_SERVICE_ACCOUNT_JSON: ref+gcpsecrets://demoo-ooclock/content_manager_service_account
MICROBLOG_APP_TOKEN: ref+gcpsecrets://demoo-ooclock/microblog-content-manager
MICROBLOG_XMLRPC_TOKEN: ref+gcpsecrets://demoo-ooclock/marsedit_token
```

The `ref+gcpsecrets://PROJECT/SECRET_NAME` format resolves each value from Google Secret Manager at runtime.

### Running Scripts

Use `vals exec -f .vals.yaml --` to inject secrets before any command:

```bash
vals exec -f .vals.yaml -- node src/sync-content.js
```

Output:

```text
Secrets injected successfully
```

The npm scripts wrap this automatically:

```bash
npm run sync          # run full sync
npm run sync:test     # dry-run mode
npm run check-posts   # check Micro.blog post state
```

### Export secrets to the current shell

When you need secrets in your shell session (e.g., for one-off scripts):

```bash
eval $(vals exec -f .vals.yaml -- env | grep -E 'GOOGLE_SERVICE|MICROBLOG|BLUESKY|LINKEDIN')
```

### Adding new secrets

To add a new secret:

1. Create it in Google Secret Manager:
   ```bash
   echo -n "secret_value" | gcloud secrets create my_secret_name \
     --data-file=- --replication-policy=automatic --project=demoo-ooclock
   ```

2. Add it to `.vals.yaml`:
   ```yaml
   MY_ENV_VAR: ref+gcpsecrets://demoo-ooclock/my_secret_name
   ```

See `CLAUDE.md` for the full list of secrets needed and which ones still need to be created.

## Running Scripts Locally

### Content Sync (dry run)

```bash
DRY_RUN=true LOG_LEVEL=DEBUG vals exec -f .vals.yaml -- node -r dotenv/config src/sync-content.js
```

Output (truncated):

```text
============================================================
🔍 DRY-RUN MODE ENABLED - No actual API calls will be made
============================================================

[2026-04-06 09:18:33] INFO: Reading spreadsheet: 1E10fSvDbcDdtNNtDQ9QtydUXSBZH2znY6ztIxT4fwVs
[2026-04-06 09:18:34] INFO:   Found 148 rows in Sheet1
[2026-04-06 09:18:34] INFO:   Found 289 rows in 2024 & earlier
[2026-04-06 09:18:34] INFO: Found 437 total rows (including header)
```

### Content Sync (live)

```bash
npm run sync
```

### Social Posts

```bash
vals exec -f .vals.yaml -- node src/post-social-content.js
```

Requires `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`, `MASTODON_ACCESS_TOKEN`, `MASTODON_INSTANCE_URL`, and `SOCIAL_POSTS_SHEET_ID` to be set in `.vals.yaml`. See `CLAUDE.md` for creation commands.

### LinkedIn OAuth Setup (one-time)

```bash
vals exec -f .vals.yaml -- node src/linkedin-oauth-setup.js
```

This opens a browser for authorization and stores the access token, expiry, and person URN in Secret Manager automatically.

## Tests

```bash
npm test
```

Output:

```text
Test Suites: 6 passed, 6 total
Tests:       75 passed, 75 total
```

## Troubleshooting

### "GOOGLE_SERVICE_ACCOUNT_JSON not set"

vals isn't loading secrets. Check:

1. vals is installed: `which vals`
2. You're authenticated to Google Cloud: `gcloud auth application-default print-access-token`
3. `.vals.yaml` exists and the secret names match what's in Secret Manager
4. The secret exists: `gcloud secrets list --project=demoo-ooclock`

### "ref+gcpsecrets: secret not found"

The secret name in `.vals.yaml` doesn't match what's in Secret Manager. Verify:

```bash
gcloud secrets list --project=demoo-ooclock
```

The secret entry in `.vals.yaml` is commented out — uncomment it after creating the secret.

### Authentication error

```bash
gcloud auth application-default login
```

## GitHub Actions

Secrets are injected via GitHub Actions secrets (not vals). See `.github/workflows/daily-sync.yml` for the full list. The env var names in GitHub Actions match those in `.vals.yaml`.

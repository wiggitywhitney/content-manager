# Development Setup

This document covers local development setup and common workflows for the content-manager project.

## Prerequisites

- Node.js >= 18.0.0
- [Teller](https://github.com/tellerops/teller) for local secret management
- Google Cloud project with Secret Manager enabled
- Access to the content tracking spreadsheets

## Secret Management with Teller

This project uses [Teller](https://github.com/tellerops/teller) to manage secrets locally, pulling from Google Secret Manager.

### Configuration

Secrets are configured in `.teller.yml`:

```yaml
project: content-manager
providers:
  google_secrets_manager:
    kind: google_secretmanager
    maps:
      - id: secrets
        path: projects/demoo-ooclock
        keys:
          content_manager_service_account: GOOGLE_SERVICE_ACCOUNT_JSON
          microblog-content-manager: MICROBLOG_APP_TOKEN
          marsedit_token: MICROBLOG_XMLRPC_TOKEN
```

### Running Scripts with Teller

**Important**: Teller requires the **full path** to the node executable, not just `node`.

#### Method 1: Using npm scripts (recommended)

```bash
# Run the sync script
npm run sync

# Run historical analysis
npm run analyze-historical
```

The npm scripts use `$(which node)` to automatically find the correct node path:

```json
{
  "scripts": {
    "sync": "teller run -- $(which node) src/sync-content.js",
    "analyze-historical": "teller run -- $(which node) src/analyze-historical-sheets.js"
  }
}
```

#### Method 2: Direct teller command

```bash
# Find your node path first
which node
# Output: /opt/homebrew/bin/node (or similar)

# Use the full path with teller
teller run -- /opt/homebrew/bin/node src/sync-content.js

# Or use command substitution
teller run -- $(which node) src/sync-content.js
```

#### Method 3: Export secrets to environment

```bash
# Export teller secrets to current shell
source <(teller sh)

# Now run scripts normally
node src/sync-content.js
```

### Common Teller Commands

```bash
# View all secrets (redacted)
teller show

# Check teller configuration
teller validate

# Run a command with secrets
teller run -- <full-path-to-command>
```

## Running Scripts Locally

### Content Sync

```bash
# Sync content from spreadsheet to Micro.blog
npm run sync

# With debug logging
LOG_LEVEL=DEBUG npm run sync
```

### Historical Analysis

```bash
# Analyze historical spreadsheet formats
npm run analyze-historical
```

## Troubleshooting

### "GOOGLE_SERVICE_ACCOUNT_JSON not set"

This means teller isn't loading secrets. Check:

1. Teller is installed: `which teller`
2. You're authenticated to Google Cloud: `gcloud auth list`
3. `.teller.yml` exists and is properly configured
4. Secrets exist in Google Secret Manager

### "No such file or directory" with teller

This error occurs when teller can't find the command. Make sure you're using the **full path to node**:

```bash
# ❌ This won't work
teller run -- node src/sync-content.js

# ✅ This works
teller run -- /opt/homebrew/bin/node src/sync-content.js

# ✅ Or use which
teller run -- $(which node) src/sync-content.js

# ✅ Or use npm scripts (recommended)
npm run sync
```

### Teller can't access Secret Manager

Ensure you're authenticated to Google Cloud:

```bash
# Login
gcloud auth application-default login

# Verify
gcloud auth application-default print-access-token
```

## Testing Changes

### Local Testing

```bash
# Test with dry-run (if implemented)
npm run sync -- --dry-run

# Test with debug logging
LOG_LEVEL=DEBUG npm run sync
```

### Testing New Scripts

When creating new scripts that need secrets:

1. Add an npm script to package.json:
   ```json
   "my-script": "teller run -- $(which node) src/my-script.js"
   ```

2. Run it:
   ```bash
   npm run my-script
   ```

## GitHub Actions

In CI/CD, secrets are injected via GitHub Secrets (not Teller):

```yaml
- name: Run content sync
  env:
    GOOGLE_SERVICE_ACCOUNT_JSON: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}
    MICROBLOG_APP_TOKEN: ${{ secrets.MICROBLOG_APP_TOKEN }}
    MICROBLOG_XMLRPC_TOKEN: ${{ secrets.MICROBLOG_XMLRPC_TOKEN }}
  run: node src/sync-content.js
```

Note: CI uses `node` directly (not teller), since secrets are already in the environment.

## Additional Resources

- [Teller Documentation](https://github.com/tellerops/teller)
- [Google Secret Manager](https://cloud.google.com/secret-manager)
- [Micro.blog API Documentation](docs/microblog-api-capabilities.md)

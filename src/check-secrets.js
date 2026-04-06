// ABOUTME: Acceptance gate — verifies all expected secrets are injected via vals before deployment.
// ABOUTME: Run with: vals exec -f .vals.yaml -- node src/check-secrets.js

'use strict';

// Secrets expected to be present in the active (non-commented) .vals.yaml entries.
// Update this list whenever a new secret is uncommented in .vals.yaml.
const REQUIRED_SECRETS = [
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'MICROBLOG_APP_TOKEN',
  'MICROBLOG_XMLRPC_TOKEN',
  'BLUESKY_PASSWORD',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
];

// Secrets needed for social posting — only required once those entries are
// uncommented in .vals.yaml (i.e., after the GSM secrets are created).
const SOCIAL_SECRETS = [
  'BLUESKY_HANDLE',
  'BLUESKY_APP_PASSWORD',
  'MASTODON_ACCESS_TOKEN',
  'MASTODON_INSTANCE_URL',
  'SOCIAL_POSTS_SHEET_ID',
  'LINKEDIN_ACCESS_TOKEN',
  'LINKEDIN_PERSON_URN',
];

function checkSecrets(names, label) {
  const missing = names.filter(k => !process.env[k]);
  const present = names.filter(k => !!process.env[k]);
  console.log(`[check-secrets] ${label}: ${present.length}/${names.length} present`);
  if (missing.length) {
    missing.forEach(k => console.log(`  MISSING: ${k}`));
  }
  return missing;
}

const missingRequired = checkSecrets(REQUIRED_SECRETS, 'Core secrets');
const missingSocial = checkSecrets(SOCIAL_SECRETS, 'Social posting secrets (pending GSM setup)');

if (missingRequired.length > 0) {
  console.error('\n[check-secrets] FAIL — required secrets missing. Check .vals.yaml and GSM.');
  process.exit(1);
}

if (missingSocial.length > 0) {
  console.warn('\n[check-secrets] WARN — social secrets not yet configured.');
  console.warn('  See CLAUDE.md "Secrets that still need to be created in GSM" for setup commands.');
} else {
  console.log('\n[check-secrets] All secrets present.');
}

console.log('\n[check-secrets] PASS');

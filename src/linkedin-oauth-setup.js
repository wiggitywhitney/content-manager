// ABOUTME: One-time OAuth 2.0 setup script for LinkedIn API access.
// ABOUTME: Opens browser for authorization, captures callback, stores token and person URN in Secret Manager.

'use strict';

const http = require('http');
const crypto = require('crypto');
const { spawnSync, exec } = require('child_process');

const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = ['w_member_social', 'openid', 'profile'];
const GCP_PROJECT = 'demoo-ooclock';
const LINKEDIN_VERSION = '202603';

/**
 * Build the LinkedIn OAuth authorization URL.
 *
 * @param {string} clientId
 * @param {string} state - Random state value for CSRF protection
 * @returns {string} Authorization URL
 */
function buildAuthUrl(clientId, state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    state,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

/**
 * Wait for the OAuth callback on localhost:3000 and return the authorization code.
 *
 * @param {string} expectedState - State value to validate
 * @returns {Promise<string>} The authorization code
 */
function waitForCallback(expectedState) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3000');

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        const safeError = String(error).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>Authorization failed: ${safeError}</h1><p>You can close this window.</p></body></html>`);
        server.close();
        reject(new Error(`LinkedIn authorization error: ${error}`));
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>State mismatch — possible CSRF</h1></body></html>');
        server.close();
        reject(new Error('State parameter mismatch'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Authorization complete!</h1><p>You can close this window and return to the terminal.</p></body></html>');
      server.close();
      resolve(code);
    });

    server.listen(3000, () => {
      console.log('[linkedin-setup] Listening on http://localhost:3000/callback ...');
    });

    server.on('error', reject);
  });
}

/**
 * Exchange an authorization code for an access token.
 *
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} code
 * @returns {Promise<{accessToken: string, expiresAt: number}>}
 */
async function exchangeCodeForToken(clientId, clientSecret, code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (typeof data.expires_in !== 'number') {
    throw new Error(`Token response missing expires_in field: ${JSON.stringify(data)}`);
  }
  const expiresAt = Date.now() + data.expires_in * 1000;
  return { accessToken: data.access_token, expiresAt };
}

/**
 * Fetch the authenticated member's person ID from /v2/me.
 *
 * @param {string} accessToken
 * @returns {Promise<string>} Person URN in the form urn:li:person:{id}
 */
async function fetchPersonUrn(accessToken) {
  const response = await fetch('https://api.linkedin.com/v2/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Linkedin-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch person ID (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (!data.id) {
    throw new Error(`LinkedIn /v2/me response missing id field: ${JSON.stringify(data)}`);
  }
  return `urn:li:person:${data.id}`;
}

/**
 * Store a value in Google Secret Manager, creating or updating as needed.
 * Uses spawnSync with argument arrays to avoid shell injection.
 *
 * @param {string} secretName
 * @param {string} value
 */
function storeSecret(secretName, value) {
  const valueBuffer = Buffer.from(value);
  let result = spawnSync(
    'gcloud',
    ['secrets', 'versions', 'add', secretName, '--data-file=-', `--project=${GCP_PROJECT}`],
    { input: valueBuffer, stdio: ['pipe', 'pipe', 'pipe'] }
  );

  if (result.status !== 0) {
    // Secret doesn't exist yet — create it
    result = spawnSync(
      'gcloud',
      ['secrets', 'create', secretName, '--data-file=-', `--project=${GCP_PROJECT}`, '--replication-policy=automatic'],
      { input: valueBuffer, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    if (result.status !== 0) {
      throw new Error(`Failed to store secret ${secretName}: ${result.stderr?.toString()}`);
    }
  }

  console.log(`[linkedin-setup] Stored ${secretName}`);
}

async function main() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId) throw new Error('LINKEDIN_CLIENT_ID environment variable is required');
  if (!clientSecret) throw new Error('LINKEDIN_CLIENT_SECRET environment variable is required');

  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = buildAuthUrl(clientId, state);

  console.log('[linkedin-setup] Opening browser for LinkedIn authorization...');
  console.log(`[linkedin-setup] If the browser does not open, visit:\n  ${authUrl}`);

  // macOS-only dev tool — open browser without shell interpolation
  const { execFile } = require('child_process');
  execFile('open', [authUrl]);

  const code = await waitForCallback(state);
  console.log('[linkedin-setup] Authorization code received. Exchanging for access token...');

  const { accessToken, expiresAt } = await exchangeCodeForToken(clientId, clientSecret, code);
  console.log('[linkedin-setup] Access token obtained.');

  console.log('[linkedin-setup] Fetching LinkedIn person URN...');
  const personUrn = await fetchPersonUrn(accessToken);
  console.log(`[linkedin-setup] Person URN: ${personUrn}`);

  console.log('[linkedin-setup] Storing secrets in Google Secret Manager...');
  storeSecret('linkedin_access_token', accessToken);
  storeSecret('linkedin_token_expires_at', String(expiresAt));
  storeSecret('linkedin_person_urn', personUrn);

  const expiryDate = new Date(expiresAt).toLocaleDateString();
  console.log(`[linkedin-setup] Done! Access token expires ${expiryDate}.`);
  console.log('[linkedin-setup] Re-run this script before that date to refresh.');
}

main().catch(err => {
  console.error('[linkedin-setup] Error:', err.message);
  process.exit(1);
});

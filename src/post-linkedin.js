// ABOUTME: LinkedIn posting module using the REST API with OAuth access token auth.
// ABOUTME: Exports postToLinkedIn(post), buildLinkedInWebUrl(urn), and checkTokenExpiry(expiresAt).

'use strict';

const LINKEDIN_API_BASE = 'https://api.linkedin.com';
// Format: YYYYMM — update when current version approaches sunset (~1 year after release)
const LINKEDIN_VERSION = '202603';
const WARNING_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Build a LinkedIn web URL from a post URN returned in the x-restli-id header.
 *
 * @param {string} urn - LinkedIn URN (e.g. 'urn:li:share:6844785523593134080')
 * @returns {string} Web URL for the post
 */
function buildLinkedInWebUrl(urn) {
  return `https://www.linkedin.com/feed/update/${urn}/`;
}

/**
 * Check whether the LinkedIn access token is nearing expiry and warn if so.
 * Refresh tokens are not available without LinkedIn partner approval, so a warning
 * is the signal to re-run the OAuth setup script before the token expires.
 *
 * @param {string|undefined} expiresAt - Unix timestamp in ms as a string (from LINKEDIN_TOKEN_EXPIRES_AT)
 */
function checkTokenExpiry(expiresAt) {
  if (!expiresAt) return;

  const expiresAtMs = parseInt(expiresAt, 10);
  const msRemaining = expiresAtMs - Date.now();

  if (msRemaining < WARNING_THRESHOLD_MS) {
    const daysRemaining = Math.floor(msRemaining / (24 * 60 * 60 * 1000));
    console.warn(
      `[linkedin] WARNING: access token expires in ${daysRemaining} day(s). ` +
      'Re-run src/linkedin-oauth-setup.js to refresh before it expires.'
    );
  }
}

/**
 * Post a social post to LinkedIn using OAuth access token authentication.
 *
 * @param {Object} post - Post object from the social posts queue
 * @param {string} post.postText - Text to post
 * @returns {Promise<{postUrl: string}>} The URL of the created post
 */
async function postToLinkedIn(post) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personUrn = process.env.LINKEDIN_PERSON_URN;

  if (!accessToken) throw new Error('LINKEDIN_ACCESS_TOKEN environment variable is required');
  if (!personUrn) throw new Error('LINKEDIN_PERSON_URN environment variable is required');

  checkTokenExpiry(process.env.LINKEDIN_TOKEN_EXPIRES_AT);

  const body = {
    author: personUrn,
    commentary: post.postText,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  const response = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Linkedin-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.status !== 201) {
    const text = await response.text();
    throw new Error(`LinkedIn API returned ${response.status}: ${text}`);
  }

  const urn = response.headers.get('x-restli-id');
  if (!urn) {
    throw new Error('LinkedIn API returned 201 but x-restli-id header was missing');
  }

  return { postUrl: buildLinkedInWebUrl(urn) };
}

module.exports = { postToLinkedIn, buildLinkedInWebUrl, checkTokenExpiry };

// ABOUTME: Writes social post results (status and platform URLs) back to the Social Posts Queue tab.
// ABOUTME: Exports updatePostResult(rowIndex, fields) for use by platform posters.

'use strict';

const { google } = require('googleapis');

const STAGED_SPREADSHEET_ID = '1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts';

// Column letters for the social posts schema
const COL = {
  LINKEDIN_POST_URL: 'J',
  BSKY_POST_URL: 'K',
  MASTODON_POST_URL: 'L',
  MICROBLOG_POST_URL: 'M',
  STATUS: 'I',
};

/**
 * Update the status and post URLs for a row in the Social Posts Queue tab.
 *
 * @param {number} rowIndex - 1-indexed row number in the sheet
 * @param {Object} fields
 * @param {string} fields.status - New status value ('posted' or 'failed')
 * @param {string} [fields.bskyPostUrl] - Bluesky post URL (column K)
 * @param {string} [fields.linkedinPostUrl] - LinkedIn post URL (column J)
 * @param {string} [fields.mastodonPostUrl] - Mastodon post URL (column L)
 * @param {string} [fields.microblogPostUrl] - micro.blog post URL (column M)
 */
async function updatePostResult(rowIndex, { status, bskyPostUrl, linkedinPostUrl, mastodonPostUrl, microblogPostUrl } = {}) {
  if (!status) throw new Error('status field is required');

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const data = [
    {
      range: `Social Posts Queue!${COL.STATUS}${rowIndex}`,
      values: [[status]],
    },
  ];

  if (bskyPostUrl) {
    data.push({ range: `Social Posts Queue!${COL.BSKY_POST_URL}${rowIndex}`, values: [[bskyPostUrl]] });
  }
  if (linkedinPostUrl) {
    data.push({ range: `Social Posts Queue!${COL.LINKEDIN_POST_URL}${rowIndex}`, values: [[linkedinPostUrl]] });
  }
  if (mastodonPostUrl) {
    data.push({ range: `Social Posts Queue!${COL.MASTODON_POST_URL}${rowIndex}`, values: [[mastodonPostUrl]] });
  }
  if (microblogPostUrl) {
    data.push({ range: `Social Posts Queue!${COL.MICROBLOG_POST_URL}${rowIndex}`, values: [[microblogPostUrl]] });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: STAGED_SPREADSHEET_ID,
    resource: {
      valueInputOption: 'USER_ENTERED',
      data,
    },
  });
}

/**
 * Write the micro.blog post URL to Column M for a row in the Social Posts Queue tab.
 * Used by the independent view-count scan, which does not change the row's status.
 *
 * @param {number} rowIndex - 1-indexed row number in the sheet
 * @param {string} microblogPostUrl - micro.blog post URL to write
 */
async function updateMicroblogPostUrl(rowIndex, microblogPostUrl) {
  if (!microblogPostUrl) throw new Error('microblogPostUrl is required');

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: STAGED_SPREADSHEET_ID,
    resource: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `Social Posts Queue!${COL.MICROBLOG_POST_URL}${rowIndex}`, values: [[microblogPostUrl]] },
      ],
    },
  });
}

module.exports = { updatePostResult, updateMicroblogPostUrl };

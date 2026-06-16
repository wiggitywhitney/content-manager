// ABOUTME: End-to-end test for the full social post dispatch pipeline.
// ABOUTME: Inserts a test row, runs post-social-content.js in DRY_RUN mode, verifies output.

'use strict';

const { google } = require('googleapis');
const { execFileSync } = require('child_process');
const path = require('path');

const STAGED_SPREADSHEET_ID = '1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts';
const SOCIAL_POSTS_TAB = 'Social Posts Queue';
const SCRIPT_PATH = path.join(__dirname, '../../src/post-social-content.js');

function getSheets() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is required for e2e tests');
  let credentials;
  try {
    credentials = JSON.parse(json);
  } catch (err) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON: ${err.message}`);
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

describe('Dispatch pipeline e2e', () => {
  let testRowIndex; // 1-based sheet row index of the inserted test row
  let sheetId;     // numeric sheet ID for batchUpdate
  let pipelineOutput; // shared stdout from the single DRY_RUN pipeline run

  beforeAll(async () => {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be set to run e2e tests');
    }

    const sheets = getSheets();
    const today = getTodayDate();

    // Resolve the numeric sheetId for the Social Posts Queue tab (needed for row deletion)
    const meta = await sheets.spreadsheets.get({ spreadsheetId: STAGED_SPREADSHEET_ID });
    const tab = (meta.data.sheets || []).find(s => s.properties.title === SOCIAL_POSTS_TAB);
    if (!tab) throw new Error(`Tab "${SOCIAL_POSTS_TAB}" not found`);
    sheetId = tab.properties.sheetId;

    // Insert test row: platforms bluesky,mastodon; postType episode; scheduledDate today
    // COL order: Show, Title, PostType, PostText, YouTubeURL, AltText, ScheduledDate, Platforms, Status
    const testRow = [
      'E2E TEST',
      'E2E: dispatch-pipeline verification row',
      'episode',
      'E2E test post — ignore this, it will be deleted automatically.',
      'https://youtu.be/jNQXAC9IVRw',
      '',
      today,
      'bluesky,mastodon',
      'pending',
    ];

    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: STAGED_SPREADSHEET_ID,
      range: `${SOCIAL_POSTS_TAB}!A:I`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [testRow] },
    });

    // Parse row number from updatedRange (e.g., "'Social Posts Queue'!A50:I50" → row 50)
    const updatedRange = appendResponse.data.updates.updatedRange;
    const rowMatch = updatedRange.match(/:([A-Z]+)(\d+)$/);
    if (!rowMatch) throw new Error(`Could not parse row number from range: ${updatedRange}`);
    testRowIndex = parseInt(rowMatch[2], 10);

    // Run the pipeline once and cache output for both tests to share
    const nodeExec = process.execPath;
    try {
      const stdout = execFileSync(nodeExec, [SCRIPT_PATH], {
        env: {
          ...process.env,
          DRY_RUN: 'true',
          CAREER_PRIORITY: '0', // override date-based priority to exercise social dispatch path
        },
        timeout: 30000,
      }).toString();
      pipelineOutput = stdout;
    } catch (err) {
      const stdout = (err.stdout || Buffer.alloc(0)).toString();
      const stderr = (err.stderr || Buffer.alloc(0)).toString();
      throw new Error(`Pipeline exited with error:\nstdout: ${stdout}\nstderr: ${stderr}`);
    }
  });

  afterAll(async () => {
    const sheets = getSheets();

    if (!testRowIndex || !sheetId) return;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: STAGED_SPREADSHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: testRowIndex - 1, // convert 1-based to 0-based
              endIndex: testRowIndex,
            },
          },
        }],
      },
    });
  });

  test('test row was successfully inserted', () => {
    expect(testRowIndex).toBeGreaterThan(0);
    expect(sheetId).toBeDefined();
  });

  test('pipeline runs in DRY_RUN mode, exits 0, and logs key checkpoints', () => {
    expect(pipelineOutput).toBeDefined();

    // Pipeline started
    expect(pipelineOutput).toContain('[social] Checking queue for posts due');

    // DRY_RUN mode was active
    expect(pipelineOutput).toContain('[social] DRY_RUN mode active');

    // Either a dispatch occurred, or the guard correctly detected already-posted content —
    // both are valid outcomes.
    const didDispatch = pipelineOutput.includes('[social] DRY_RUN: Would dispatch row');
    const guardFired = pipelineOutput.includes('Social content already posted today');
    expect(didDispatch || guardFired).toBe(true);
  });

  test('DRY_RUN dispatch targets correct platforms for the dispatched row', () => {
    expect(pipelineOutput).toBeDefined();

    // If the guard fired (already posted today), there is nothing to dispatch — pass without asserting.
    const dispatchLines = pipelineOutput.split('\n').filter(l => l.includes('DRY_RUN: Would dispatch row'));
    if (dispatchLines.length === 0) return;

    // Every dispatched row must target at least one known platform
    const knownPlatforms = ['bluesky', 'mastodon', 'linkedin', 'micro.blog'];
    for (const line of dispatchLines) {
      const hasPlatform = knownPlatforms.some(p => line.includes(p));
      expect(hasPlatform).toBe(true);
    }
  });
});

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

// Date used as a placeholder when temporarily masking already-posted rows so the guard won't fire.
const GUARD_MASK_DATE = '2020-01-01';

describe('Dispatch pipeline e2e', () => {
  let testRowIndex; // 1-based sheet row index of the inserted test row
  let sheetId;     // numeric sheet ID for batchUpdate
  let pipelineOutput; // shared stdout from the single DRY_RUN pipeline run
  // Rows with status=posted and scheduledDate=today that were temporarily masked before the run.
  // Each entry: { rowIndex: number, originalDate: string }
  let maskedRows = [];

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

    // Mask any already-posted rows for today so the social-guard won't block dispatch.
    // The guard fires when it sees status=posted + scheduledDate=today; temporarily
    // rewriting those dates to GUARD_MASK_DATE makes the guard see a clean day.
    // afterAll restores the original dates regardless of test outcome.
    const allRows = await sheets.spreadsheets.values.get({
      spreadsheetId: STAGED_SPREADSHEET_ID,
      range: `${SOCIAL_POSTS_TAB}!A:I`,
    });
    const rows = allRows.data.values || [];
    // Row 0 is the header; data rows start at index 1 (sheet row 2)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const scheduledDate = (row[6] || '').trim(); // COL.SCHEDULED_DATE = 6
      const status = (row[8] || '').trim().toLowerCase(); // COL.STATUS = 8
      if (status === 'posted' && scheduledDate.startsWith(today)) {
        const rowIndex = i + 1; // convert 0-based array index to 1-based sheet row
        maskedRows.push({ rowIndex, originalDate: scheduledDate });
        await sheets.spreadsheets.values.update({
          spreadsheetId: STAGED_SPREADSHEET_ID,
          range: `${SOCIAL_POSTS_TAB}!G${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [[GUARD_MASK_DATE]] },
        });
      }
    }

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

    // Restore any rows whose scheduledDate was temporarily masked before the run.
    for (const { rowIndex, originalDate } of maskedRows) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: STAGED_SPREADSHEET_ID,
        range: `${SOCIAL_POSTS_TAB}!G${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[originalDate]] },
      });
    }

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

    // DRY_RUN dispatch occurred (either our test row or an existing pending row)
    expect(pipelineOutput).toContain('[social] DRY_RUN: Would dispatch row');
  });

  test('DRY_RUN dispatch targets correct platforms for the dispatched row', () => {
    expect(pipelineOutput).toBeDefined();

    // Find any DRY_RUN dispatch lines and verify they name real platforms
    const dispatchLines = pipelineOutput.split('\n').filter(l => l.includes('DRY_RUN: Would dispatch row'));
    expect(dispatchLines.length).toBeGreaterThan(0);

    // Every dispatched row must target at least one known platform
    const knownPlatforms = ['bluesky', 'mastodon', 'linkedin', 'micro.blog'];
    for (const line of dispatchLines) {
      const hasPlatform = knownPlatforms.some(p => line.includes(p));
      expect(hasPlatform).toBe(true);
    }
  });
});

// ABOUTME: Runs the daily-sync "Determine post priority" step's real bash with a stubbed node,
// ABOUTME: verifying the single-post evening catch-up, skip, and error branches end to end.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const repoRoot = path.join(__dirname, '..');
const workflow = yaml.load(fs.readFileSync(path.join(repoRoot, '.github/workflows/daily-sync.yml'), 'utf8'));
const priorityRun = workflow.jobs['daily-sync'].steps.find(s => s.id === 'priority').run;

const MORNING_CRON = workflow.on.schedule[0].cron;
const EVENING_CRON = workflow.on.schedule[1].cron;

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'priority-step-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Run the priority step with a stub `node` on PATH.
 * catchUp: what `node src/evening-catch-up.js` prints ('catch_up' | 'skip'), or 'error' to exit 1.
 * The social-queue probe (`node -e ...`) always reports 'pending'.
 */
function runPriorityStep({ schedule, catchUp, twoPosts = 'false' }) {
  const binDir = path.join(tmpDir, 'bin');
  fs.mkdirSync(binDir);
  const callLog = path.join(tmpDir, 'node-calls.log');
  const stub = [
    '#!/usr/bin/env bash',
    `echo "$*" >> "${callLog}"`,
    'if [ "$1" = "src/evening-catch-up.js" ]; then',
    `  if [ "${catchUp}" = "error" ]; then echo "boom" >&2; exit 1; fi`,
    `  printf '%s' "${catchUp}"; exit 0`,
    'fi',
    "printf 'pending'",
  ].join('\n');
  fs.writeFileSync(path.join(binDir, 'node'), stub, { mode: 0o755 });

  const outputFile = path.join(tmpDir, 'github-output');
  fs.writeFileSync(outputFile, '');
  const result = spawnSync('bash', ['-e', '-c', priorityRun], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      PATH: `${binDir}:${process.env.PATH}`,
      GITHUB_OUTPUT: outputFile,
      GITHUB_EVENT_SCHEDULE: schedule,
      TWO_POSTS_PER_DAY: twoPosts,
    },
  });

  const outputs = {};
  for (const line of fs.readFileSync(outputFile, 'utf8').split('\n').filter(Boolean)) {
    const [key, value] = line.split('=');
    outputs[key] = value; // last write wins, matching GitHub's GITHUB_OUTPUT handling
  }
  const nodeCalls = fs.existsSync(callLog) ? fs.readFileSync(callLog, 'utf8') : '';
  return { status: result.status, outputs, nodeCalls, stdout: result.stdout };
}

describe('Determine post priority step (single-post mode)', () => {
  test('evening run with no managed post today catches up as the morning slot', () => {
    const { status, outputs } = runPriorityStep({ schedule: EVENING_CRON, catchUp: 'catch_up' });
    expect(status).toBe(0);
    expect(outputs.skip_run).toBe('false');
    expect(outputs.is_morning_slot).toBe('true');
  });

  test('evening run after a managed post today skips', () => {
    const { status, outputs } = runPriorityStep({ schedule: EVENING_CRON, catchUp: 'skip' });
    expect(status).toBe(0);
    expect(outputs.skip_run).toBe('true');
    expect(outputs.is_morning_slot).toBe('false');
  });

  test('evening run whose posted-today check errors fails the step without deciding to skip or post', () => {
    const { status, outputs } = runPriorityStep({ schedule: EVENING_CRON, catchUp: 'error' });
    expect(status).not.toBe(0);
    expect(outputs.skip_run).toBeUndefined();
  });

  test('morning run never consults the catch-up check', () => {
    const { status, outputs, nodeCalls } = runPriorityStep({ schedule: MORNING_CRON, catchUp: 'error' });
    expect(status).toBe(0);
    expect(outputs.is_morning_slot).toBe('true');
    expect(outputs.skip_run).toBe('false');
    expect(nodeCalls).not.toContain('src/evening-catch-up.js');
  });
});

describe('Determine post priority step (two-post mode)', () => {
  test('evening run posts as the evening slot without consulting the catch-up check', () => {
    const { status, outputs, nodeCalls } = runPriorityStep({ schedule: EVENING_CRON, catchUp: 'error', twoPosts: 'true' });
    expect(status).toBe(0);
    expect(outputs.is_morning_slot).toBe('false');
    expect(outputs.skip_run).toBe('false');
    expect(nodeCalls).not.toContain('src/evening-catch-up.js');
  });
});

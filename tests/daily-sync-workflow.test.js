// ABOUTME: Tests that the daily-sync workflow YAML is configured correctly.
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const workflowPath = path.join(__dirname, '../.github/workflows/daily-sync.yml');

let workflow;

beforeAll(() => {
  const raw = fs.readFileSync(workflowPath, 'utf8');
  workflow = yaml.load(raw);
});

describe('daily-sync workflow', () => {
  describe('yt-dlp', () => {
    // YouTube blocks yt-dlp from GitHub Actions runners, and every video the cron posts
    // comes from the Drive copy in Column O, so the job installs no yt-dlp.
    test('is not installed or updated in the daily-sync job', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const ytDlpSteps = steps.filter(s => (s.uses || '').includes('yt-dlp') || (s.run || '').includes('yt-dlp'));
      expect(ytDlpSteps).toEqual([]);
    });
  });

  describe('LinkedIn credentials from GSM', () => {
    let dailySyncSteps;
    let gsmStep;
    let postStep;

    beforeAll(() => {
      dailySyncSteps = workflow.jobs['daily-sync'].steps;
      gsmStep = dailySyncSteps.find(s => s.name && s.name.toLowerCase().includes('read credentials from gsm'));
      postStep = dailySyncSteps.find(s => s.name === 'Post social content');
    });

    test('daily-sync job has a step to read LinkedIn credentials from GSM', () => {
      expect(gsmStep).toBeDefined();
    });

    test('GSM step reads linkedin_access_token', () => {
      expect(gsmStep.run).toContain('linkedin_access_token');
    });

    test('GSM step reads linkedin_token_expires_at', () => {
      expect(gsmStep.run).toContain('linkedin_token_expires_at');
    });

    test('GSM step reads linkedin_person_urn', () => {
      expect(gsmStep.run).toContain('linkedin_person_urn');
    });

    test('GSM step masks all three secrets before exporting to GITHUB_ENV', () => {
      expect(gsmStep.run).toContain('::add-mask::$LINKEDIN_ACCESS_TOKEN');
      expect(gsmStep.run).toContain('::add-mask::$LINKEDIN_TOKEN_EXPIRES_AT');
      expect(gsmStep.run).toContain('::add-mask::$LINKEDIN_PERSON_URN');
    });

    test('GSM step reads DD_API_KEY from GSM', () => {
      expect(gsmStep.run).toContain('datadog-commit-story-dev');
    });

    test('GSM step masks DD_API_KEY before exporting to GITHUB_ENV', () => {
      expect(gsmStep.run).toContain('::add-mask::$DD_API_KEY');
    });

    test('GSM step exports DD_API_KEY to GITHUB_ENV', () => {
      expect(gsmStep.run).toContain('DD_API_KEY=$DD_API_KEY');
    });

    test('GSM step uses GOOGLE_SERVICE_ACCOUNT_JSON for authentication', () => {
      expect(gsmStep.env && gsmStep.env.GOOGLE_SERVICE_ACCOUNT_JSON).toBeDefined();
    });

    test('GSM step appears before Post social content step', () => {
      const gsmIndex = dailySyncSteps.indexOf(gsmStep);
      const postIndex = dailySyncSteps.indexOf(postStep);
      expect(gsmIndex).toBeGreaterThanOrEqual(0);
      expect(gsmIndex).toBeLessThan(postIndex);
    });

    test('Post social content step does not declare LINKEDIN_ACCESS_TOKEN in its own env block', () => {
      expect(postStep.env && postStep.env.LINKEDIN_ACCESS_TOKEN).toBeUndefined();
    });

    test('Post social content step does not declare LINKEDIN_TOKEN_EXPIRES_AT in its own env block', () => {
      expect(postStep.env && postStep.env.LINKEDIN_TOKEN_EXPIRES_AT).toBeUndefined();
    });

    test('Post social content step does not declare LINKEDIN_PERSON_URN in its own env block', () => {
      expect(postStep.env && postStep.env.LINKEDIN_PERSON_URN).toBeUndefined();
    });
  });

  describe('two-post mode configuration', () => {
    test('has morning cron trigger at 13:17 UTC (8:17am CDT)', () => {
      const crons = workflow.on.schedule.map(s => s.cron);
      expect(crons).toContain('17 13 * * *');
    });

    test('has evening cron trigger at 21:17 UTC (4:17pm CDT)', () => {
      const crons = workflow.on.schedule.map(s => s.cron);
      expect(crons).toContain('17 21 * * *');
    });

    test('has midday catch-up cron trigger at 17:17 UTC (12:17pm CDT)', () => {
      const crons = workflow.on.schedule.map(s => s.cron);
      expect(crons).toContain('17 17 * * *');
    });

    test('every cron schedule is one scripts/determine-slot.sh recognizes', () => {
      const { spawnSync } = require('child_process');
      const script = path.join(__dirname, '../scripts/determine-slot.sh');
      const results = workflow.on.schedule.map(s => spawnSync(script, [s.cron], { encoding: 'utf8' }));
      // An unrecognized schedule falls back to morning with a warning on stderr
      results.forEach(r => expect(r.stderr).toBe(''));
      expect(results.map(r => r.stdout.trim()).sort()).toEqual(['evening', 'midday', 'morning']);
    });

    test('no cron fires at the top of the hour, when GitHub delays scheduled runs most', () => {
      const minutes = workflow.on.schedule.map(s => s.cron.split(' ')[0]);
      expect(minutes).not.toContain('0');
    });

    test('daily-sync job queues overlapping runs instead of cancelling an in-progress post', () => {
      const concurrency = workflow.jobs['daily-sync'].concurrency;
      expect(concurrency.group).toBe('daily-sync-${{ github.ref }}');
      expect(concurrency['cancel-in-progress']).toBe(false);
    });

    test('daily-sync job has TWO_POSTS_PER_DAY env var set to false', () => {
      const jobEnv = workflow.jobs['daily-sync'].env || {};
      expect(jobEnv.TWO_POSTS_PER_DAY).toBe('false');
    });

    test('Determine post priority step runs before Scan for new content', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const priorityIndex = steps.findIndex(s => s.id === 'priority');
      const scanIndex = steps.findIndex(s => s.name === 'Scan for new content');
      expect(priorityIndex).toBeGreaterThanOrEqual(0);
      expect(scanIndex).toBeGreaterThanOrEqual(0);
      expect(priorityIndex).toBeLessThan(scanIndex);
    });

    test('Scan for new content step is gated on skip_run', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const scanStep = steps.find(s => s.name === 'Scan for new content');
      expect(scanStep.if).toContain('skip_run');
    });

    test('Determine post priority step computes is_morning_slot output', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const priorityStep = steps.find(s => s.id === 'priority');
      expect(priorityStep.run).toContain('is_morning_slot');
    });

    test('Determine post priority step classifies slot via scripts/determine-slot.sh, not wall-clock hour', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const priorityStep = steps.find(s => s.id === 'priority');
      expect(priorityStep.run).toContain('scripts/determine-slot.sh');
      expect(priorityStep.run).not.toContain('date -u +%H');
    });

    test('Determine post priority step passes github.event.schedule via env, not inline interpolation', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const priorityStep = steps.find(s => s.id === 'priority');
      expect(priorityStep.env && priorityStep.env.GITHUB_EVENT_SCHEDULE).toBe('${{ github.event.schedule }}');
      expect(priorityStep.run).not.toContain('${{ github.event.schedule }}');
    });

    test('single-post runs of every slot decide skip vs. post via src/evening-catch-up.js', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const priorityStep = steps.find(s => s.id === 'priority');
      expect(priorityStep.run).toContain('node src/evening-catch-up.js "$SLOT"');
      expect(priorityStep.env.GOOGLE_SERVICE_ACCOUNT_JSON).toBe('${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}');
    });

    test('a failed catch-up check fails the step instead of skipping or posting', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const priorityStep = steps.find(s => s.id === 'priority');
      expect(priorityStep.run).toMatch(/node src\/evening-catch-up\.js "\$SLOT"\)?\s*\|\|\s*exit 1/);
    });

    test('is_morning_slot output is written after the catch-up decision, so a catch-up runs as the morning slot', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const run = steps.find(s => s.id === 'priority').run;
      const catchUpIndex = run.indexOf('node src/evening-catch-up.js');
      const outputIndexes = [...run.matchAll(/is_morning_slot=/g)].map(m => m.index);
      expect(catchUpIndex).toBeGreaterThanOrEqual(0);
      expect(outputIndexes.length).toBeGreaterThan(0);
      outputIndexes.forEach(i => expect(i).toBeGreaterThan(catchUpIndex));
    });

    test('Determine post priority step computes skip_run output', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const priorityStep = steps.find(s => s.id === 'priority');
      expect(priorityStep.run).toContain('skip_run');
    });

    test('Post social content step has access to TWO_POSTS_PER_DAY', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const postStep = steps.find(s => s.name === 'Post social content');
      const jobEnv = workflow.jobs['daily-sync'].env || {};
      const stepEnv = postStep.env || {};
      expect(jobEnv.TWO_POSTS_PER_DAY || stepEnv.TWO_POSTS_PER_DAY).toBeDefined();
    });

    test('Post social content step passes IS_MORNING_SLOT from priority step output', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const postStep = steps.find(s => s.name === 'Post social content');
      const stepEnv = postStep.env || {};
      expect(stepEnv.IS_MORNING_SLOT).toContain('is_morning_slot');
    });

    test('both steps that can post are gated on skip_run, so a run that skips posts nothing', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const careerStep = steps.find(s => s.name === 'Sync content to Micro.blog and update About page');
      const postStep = steps.find(s => s.name === 'Post social content');
      expect(careerStep.if).toMatch(/^steps\.priority\.outputs\.skip_run != 'true' && /);
      expect(postStep.if).toContain("steps.priority.outputs.skip_run != 'true'");
    });

    test('Sync career content step condition includes is_morning_slot and TWO_POSTS_PER_DAY for evening slot routing', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const careerStep = steps.find(s => s.name === 'Sync content to Micro.blog and update About page');
      // Evening slot in two-post mode must trigger career sync regardless of day parity
      expect(careerStep.if).toContain('is_morning_slot');
      expect(careerStep.if).toContain('TWO_POSTS_PER_DAY');
    });
  });

  describe('emit LinkedIn token expiry metric step', () => {
    let dailySyncSteps;
    let metricStep;
    let gsmStep;
    let postStep;

    beforeAll(() => {
      dailySyncSteps = workflow.jobs['daily-sync'].steps;
      metricStep = dailySyncSteps.find(s => s.name === 'Emit LinkedIn token expiry metric');
      gsmStep = dailySyncSteps.find(s => s.name && s.name.toLowerCase().includes('read credentials from gsm'));
      postStep = dailySyncSteps.find(s => s.name === 'Post social content');
    });

    test('step exists in daily-sync job', () => {
      expect(metricStep).toBeDefined();
    });

    test('step is gated on skip_run so it does not run when the workflow skips', () => {
      expect(metricStep.if).toContain('skip_run');
    });

    test('step appears after Read credentials from GSM so LINKEDIN_TOKEN_EXPIRES_AT is available', () => {
      const gsmIndex = dailySyncSteps.indexOf(gsmStep);
      const metricIndex = dailySyncSteps.indexOf(metricStep);
      expect(metricIndex).toBeGreaterThan(gsmIndex);
    });

    test('step appears before Post social content', () => {
      const metricIndex = dailySyncSteps.indexOf(metricStep);
      const postIndex = dailySyncSteps.indexOf(postStep);
      expect(metricIndex).toBeLessThan(postIndex);
    });

    test('step uses LINKEDIN_TOKEN_EXPIRES_AT from GITHUB_ENV', () => {
      expect(metricStep.run).toContain('LINKEDIN_TOKEN_EXPIRES_AT');
    });

    test('step calls checkTokenExpiry or submitTokenExpiryMetric from post-linkedin', () => {
      expect(metricStep.run).toMatch(/checkTokenExpiry|submitTokenExpiryMetric/);
    });
  });

  describe('e2e-tests job: LinkedIn secrets removed', () => {
    let e2eSteps;

    beforeAll(() => {
      e2eSteps = workflow.jobs['e2e-tests'].steps;
    });

    test('Run e2e tests step does not declare LINKEDIN_ACCESS_TOKEN (unused by e2e suite)', () => {
      const step = e2eSteps.find(s => s.name === 'Run e2e tests');
      expect(step.env && step.env.LINKEDIN_ACCESS_TOKEN).toBeUndefined();
    });

    test('Run e2e tests step does not declare LINKEDIN_TOKEN_EXPIRES_AT (unused by e2e suite)', () => {
      const step = e2eSteps.find(s => s.name === 'Run e2e tests');
      expect(step.env && step.env.LINKEDIN_TOKEN_EXPIRES_AT).toBeUndefined();
    });

    test('Run e2e tests step does not declare LINKEDIN_PERSON_URN (unused by e2e suite)', () => {
      const step = e2eSteps.find(s => s.name === 'Run e2e tests');
      expect(step.env && step.env.LINKEDIN_PERSON_URN).toBeUndefined();
    });
  });
});

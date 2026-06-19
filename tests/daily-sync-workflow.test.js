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
  describe('setup-yt-dlp step', () => {
    let step;

    beforeAll(() => {
      const steps = workflow.jobs['daily-sync'].steps;
      step = steps.find(s => s.uses && s.uses.startsWith('AnimMouse/setup-yt-dlp'));
    });

    test('exists in daily-sync job', () => {
      expect(step).toBeDefined();
    });

    test('has continue-on-error: true so transient FFmpeg download failures do not abort posting', () => {
      expect(step['continue-on-error']).toBe(true);
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
    test('has morning cron trigger at 13:00 UTC (8am CDT)', () => {
      const crons = workflow.on.schedule.map(s => s.cron);
      expect(crons).toContain('0 13 * * *');
    });

    test('has evening cron trigger at 21:00 UTC (4pm CDT)', () => {
      const crons = workflow.on.schedule.map(s => s.cron);
      expect(crons).toContain('0 21 * * *');
    });

    test('daily-sync job has TWO_POSTS_PER_DAY env var set to true', () => {
      const jobEnv = workflow.jobs['daily-sync'].env || {};
      expect(jobEnv.TWO_POSTS_PER_DAY).toBe('true');
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

    test('Sync career content step condition includes is_morning_slot and TWO_POSTS_PER_DAY for evening slot routing', () => {
      const steps = workflow.jobs['daily-sync'].steps;
      const careerStep = steps.find(s => s.name === 'Sync content to Micro.blog and update About page');
      // Evening slot in two-post mode must trigger career sync regardless of day parity
      expect(careerStep.if).toContain('is_morning_slot');
      expect(careerStep.if).toContain('TWO_POSTS_PER_DAY');
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

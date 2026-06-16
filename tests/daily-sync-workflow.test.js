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

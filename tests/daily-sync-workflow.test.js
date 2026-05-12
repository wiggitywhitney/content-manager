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
});

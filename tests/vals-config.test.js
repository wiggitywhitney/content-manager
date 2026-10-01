// ABOUTME: Validates that .vals.yaml and package.json scripts are correctly configured.
// ABOUTME: Ensures teller has been fully replaced by vals across all npm scripts.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VALS_YAML = path.join(ROOT, '.vals.yaml');
const TELLER_YML = path.join(ROOT, '.teller.yml');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

describe('vals configuration', () => {
  let valsContent;
  let pkg;

  beforeAll(() => {
    if (!fs.existsSync(VALS_YAML)) {
      throw new Error('.vals.yaml must exist — run vals setup before tests');
    }
    valsContent = fs.readFileSync(VALS_YAML, 'utf8');
    pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  });

  test('.vals.yaml exists', () => {
    expect(fs.existsSync(VALS_YAML)).toBe(true);
  });

  test('.teller.yml does not exist', () => {
    expect(fs.existsSync(TELLER_YML)).toBe(false);
  });

  test('.vals.yaml references gcpsecrets for all active entries', () => {
    const activeLines = valsContent
      .split('\n')
      .filter(line => !line.trim().startsWith('#') && line.includes(':'));
    for (const line of activeLines) {
      expect(line).toMatch(/ref\+gcpsecrets:\/\//);
    }
  });

  test('.vals.yaml includes core secrets', () => {
    expect(valsContent).toContain('GOOGLE_SERVICE_ACCOUNT_JSON');
    expect(valsContent).toContain('MICROBLOG_APP_TOKEN');
    expect(valsContent).toContain('MICROBLOG_XMLRPC_TOKEN');
  });

  test('no npm script uses teller', () => {
    const scripts = Object.values(pkg.scripts || {});
    for (const script of scripts) {
      expect(script).not.toMatch(/\bteller\b/);
    }
  });

  test('all node-running npm scripts use vals exec', () => {
    const scripts = Object.entries(pkg.scripts || {});
    for (const [name, script] of scripts) {
      if (name === 'test') continue; // jest doesn't need secrets
      if (script.includes('node ') || script.includes('node\t')) {
        expect(script).toMatch(/vals exec/);
      }
    }
  });
});

describe('Slack notifier vals configuration', () => {
  const SLACK_VALS_YAML = path.join(ROOT, '.vals.slack.yaml');
  const NOTIFY_SLACK = path.join(ROOT, 'scripts', 'notify-slack.sh');

  test('.vals.yaml does not reference the Slack webhook, so a missing webhook secret cannot break other vals exec commands', () => {
    const valsContent = fs.readFileSync(VALS_YAML, 'utf8');
    expect(valsContent).not.toMatch(/^\s*SLACK_WEBHOOK_URL\s*:/m);
    expect(valsContent).not.toContain('dot_agent_deck_slack_webhook');
  });

  test('.vals.slack.yaml holds only the Slack webhook secret reference', () => {
    expect(fs.existsSync(SLACK_VALS_YAML)).toBe(true);
    const activeLines = fs.readFileSync(SLACK_VALS_YAML, 'utf8')
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('#'));
    expect(activeLines).toEqual([
      'SLACK_WEBHOOK_URL: ref+gcpsecrets://demoo-ooclock/dot_agent_deck_slack_webhook',
    ]);
  });

  test('notify-slack.sh reads the webhook from .vals.slack.yaml, not .vals.yaml', () => {
    const script = fs.readFileSync(NOTIFY_SLACK, 'utf8');
    expect(script).toContain('vals exec -f "$SCRIPT_DIR/../.vals.slack.yaml"');
    expect(script).not.toContain('.vals.yaml"');
  });

  test('notify-slack.sh passes the webhook URL to curl through stdin, never as a command-line argument', () => {
    const script = fs.readFileSync(NOTIFY_SLACK, 'utf8');
    expect(script).toContain('printf "url = \\"%s\\"\\n" "$SLACK_WEBHOOK_URL" | curl --config -');
    const argvUse = script
      .split('\n')
      .filter(line => line.includes('"$SLACK_WEBHOOK_URL"') && !line.includes('printf'));
    expect(argvUse).toEqual([]);
  });
});

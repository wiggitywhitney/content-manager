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

  // Without -i, vals exec drops every inherited variable, including PATH and
  // any DRY_RUN/LOG_LEVEL set in front of the command.
  test('sync:test inherits DRY_RUN and LOG_LEVEL through vals exec -i', () => {
    expect(pkg.scripts['sync:test']).toBe(
      'DRY_RUN=true LOG_LEVEL=DEBUG vals exec -i -f .vals.yaml -- node -r dotenv/config src/sync-content.js'
    );
  });

  test('sync stays a local dry run (no DRY_RUN=false)', () => {
    expect(pkg.scripts.sync).not.toMatch(/DRY_RUN=false/);
  });
});

describe('CLAUDE.md dry-run guidance', () => {
  let claudeMd;

  beforeAll(() => {
    claudeMd = fs.readFileSync(path.join(ROOT, '.claude', 'CLAUDE.md'), 'utf8');
  });

  test('CORRECT dry-run command uses vals exec -i and keeps DRY_RUN inside bash -c', () => {
    expect(claudeMd).toContain(
      "vals exec -i -f .vals.yaml -- bash -c 'DRY_RUN=true node src/post-social-content.js'"
    );
    expect(claudeMd).not.toContain(
      "vals exec -f .vals.yaml -- bash -c 'DRY_RUN=true node src/post-social-content.js'"
    );
  });

  test('WRONG example and its warning are unchanged', () => {
    expect(claudeMd).toContain('# WRONG — vals exec strips DRY_RUN, posts go live');
    expect(claudeMd).toContain('DRY_RUN=true vals exec -f .vals.yaml -- node src/post-social-content.js');
  });

  test('notes that npm run sync is a dry run locally', () => {
    expect(claudeMd).toMatch(/npm run sync\s+#.*dry run locally/i);
  });
});

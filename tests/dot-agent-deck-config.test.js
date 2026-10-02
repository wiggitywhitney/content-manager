// ABOUTME: Structural checks on .dot-agent-deck.toml role prompts and the gitignored handoff directory.
// ABOUTME: Guards the orchestration flow decided in PRD #126 (Decisions #23-30) against drift.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DECK_TOML = path.join(ROOT, '.dot-agent-deck.toml');
const GITIGNORE = path.join(ROOT, '.gitignore');

// Extracts each [[orchestrations.roles]] block's name and prompt_template.
// Full TOML validity is checked separately by `dot-agent-deck validate`.
function parseRolePrompts(toml) {
  const prompts = {};
  const blocks = toml.split('[[orchestrations.roles]]').slice(1);
  for (const block of blocks) {
    const name = block.match(/^name = "([^"]+)"/m);
    const prompt = block.match(/prompt_template = """([\s\S]*?)"""/);
    if (!name || !prompt) {
      throw new Error(`Role block missing name or prompt_template:\n${block}`);
    }
    prompts[name[1]] = prompt[1];
  }
  return prompts;
}

describe('.dot-agent-deck.toml role prompts', () => {
  let prompts;

  beforeAll(() => {
    prompts = parseRolePrompts(fs.readFileSync(DECK_TOML, 'utf8'));
  });

  test('defines all seven roles', () => {
    expect(Object.keys(prompts).sort()).toEqual(
      ['auditor', 'coder', 'documenter', 'orchestrator', 'release', 'reviewer', 'tester']
    );
  });

  describe('orchestrator', () => {
    test('first step creates or confirms the feature branch, escalating otherwise', () => {
      expect(prompts.orchestrator).toContain('feature/prd-<id>-<slug>');
      expect(prompts.orchestrator).toMatch(/on main/i);
      expect(prompts.orchestrator).toMatch(/any other branch/i);
    });

    test('runs PRD tracking commands itself rather than delegating them', () => {
      expect(prompts.orchestrator).toContain('/prd-next');
      expect(prompts.orchestrator).toContain('/prd-update-progress');
      expect(prompts.orchestrator).toMatch(/do NOT delegate these/);
    });

    test('runs a tester-first TDD chain', () => {
      expect(prompts.orchestrator).toMatch(/delegate to tester[^.]*failing integration test/i);
    });

    test('delegates reviewer and auditor in parallel', () => {
      expect(prompts.orchestrator).toContain('dot-agent-deck delegate --to reviewer --to auditor');
    });

    test('delegates a final full local test gate to tester before release', () => {
      for (const tier of [
        'npm test',
        'bats tests/*.bats',
        'npm run test:integration',
        'npm run test:e2e',
        'npm run check-secrets',
      ]) {
        expect(prompts.orchestrator).toContain(tier);
      }
    });

    test('includes the context-handoff section with --task-file guidance', () => {
      expect(prompts.orchestrator).toContain('Context handoff (CRITICAL)');
      expect(prompts.orchestrator).toContain('--task-file');
      expect(prompts.orchestrator).toContain('.dot-agent-deck/<task-slug>.md');
    });

    test('waits for approval in the orchestrator pane at both gates', () => {
      expect(prompts.orchestrator).toContain('scripts/notify-slack.sh escalation');
      expect(prompts.orchestrator).toContain('scripts/notify-slack.sh merge-gate');
      expect(prompts.orchestrator).toMatch(/reply in this pane/i);
    });

    test('never signals orchestration completion with work-done --done', () => {
      expect(prompts.orchestrator).not.toMatch(/work-done --done/);
    });
  });

  describe('release', () => {
    test('runs /prd-done', () => {
      expect(prompts.release).toContain('/prd-done');
    });

    test('reports review findings instead of fixing them', () => {
      expect(prompts.release).toMatch(/do NOT fix/i);
      expect(prompts.release).toContain('/code-review');
      expect(prompts.release).toContain('CodeRabbit');
    });

    test('does not merge until re-delegated with an explicit instruction', () => {
      expect(prompts.release).toMatch(/do NOT merge/);
      expect(prompts.release).toMatch(/explicit instruction to continue/i);
    });
  });

  describe('TDD ownership split', () => {
    test('tester exclusively owns tests/integration/', () => {
      expect(prompts.tester).toContain('tests/integration/');
      expect(prompts.tester).toMatch(/exclusively/i);
    });

    test('coder must not modify integration tests and owns the unit tiers', () => {
      expect(prompts.coder).toMatch(/MUST NOT create or modify[^.]*tests\/integration\//);
      expect(prompts.coder).toContain('npm test');
      expect(prompts.coder).toContain('bats tests/*.bats');
    });
  });
});

describe('.gitignore', () => {
  test('ignores the .dot-agent-deck/ handoff directory', () => {
    const lines = fs.readFileSync(GITIGNORE, 'utf8').split('\n').map(l => l.trim());
    expect(lines).toContain('.dot-agent-deck/');
  });
});

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Versioning and Release Strategy Configuration', () => {
  const rootDir = path.resolve(__dirname, '../../../../');

  it('commitlint configuration is valid and enforces conventional commits', () => {
    const commitlintPath = path.join(rootDir, 'commitlint.config.js');
    expect(fs.existsSync(commitlintPath)).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const commitlintConfig = require(commitlintPath);
    expect(commitlintConfig.extends).toContain('@commitlint/config-conventional');

    const typeEnum = commitlintConfig.rules?.['type-enum'];
    expect(Array.isArray(typeEnum)).toBe(true);
    const allowedTypes = typeEnum[2];
    expect(allowedTypes).toEqual(
      expect.arrayContaining([
        'feat',
        'fix',
        'docs',
        'chore',
        'refactor',
        'test',
        'perf',
        'ci',
        'build',
      ]),
    );
  });

  it('changeset configuration contains mandatory monorepo fields', () => {
    const changesetConfigPath = path.join(rootDir, '.changeset', 'config.json');
    expect(fs.existsSync(changesetConfigPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(changesetConfigPath, 'utf8'));
    expect(config.changelog).toBe('@changesets/cli/changelog');
    expect(config.baseBranch).toBe('main');
    expect(config.access).toBe('public');
    expect(config.commit).toBe(false);
  });

  it('root package.json defines release scripts and changelog files exist', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    expect(pkg.scripts?.changeset).toBe('changeset');
    expect(pkg.scripts?.['version:packages']).toBe('changeset version');
    expect(pkg.scripts?.release).toBe('changeset publish');

    const changelogPath = path.join(rootDir, 'CHANGELOG.md');
    expect(fs.existsSync(changelogPath)).toBe(true);
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    expect(changelogContent).toContain('## [0.1.0]');

    const releasesDocPath = path.join(rootDir, 'docs', 'RELEASES.md');
    expect(fs.existsSync(releasesDocPath)).toBe(true);
  });

  it('husky commit-msg hook executes commitlint', () => {
    const commitMsgHookPath = path.join(rootDir, '.husky', 'commit-msg');
    expect(fs.existsSync(commitMsgHookPath)).toBe(true);

    const hookContent = fs.readFileSync(commitMsgHookPath, 'utf8');
    expect(hookContent).toContain('commitlint');
  });
});

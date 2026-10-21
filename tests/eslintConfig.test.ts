import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface ScanReport {
  messages: { ruleId: string | null; fatal?: boolean }[];
  ignored: Record<string, boolean>;
}

function scanSnapshot(withPrivateExclusions: boolean): ScanReport {
  const workspace = resolve(__dirname, '..');
  const snapshot = mkdtempSync(join(tmpdir(), 'taskcard-eslint-config-'));

  try {
    copyFileSync(join(workspace, 'eslint.config.mjs'), join(snapshot, 'eslint.config.mjs'));
    copyFileSync(join(workspace, 'manifest.json'), join(snapshot, 'manifest.json'));
    symlinkSync(
      realpathSync(join(workspace, 'node_modules')),
      join(snapshot, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    mkdirSync(join(snapshot, 'src'));
    writeFileSync(join(snapshot, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { strict: true, target: 'ES2020', lib: ['ES2020', 'DOM'] },
      include: ['src/**/*.ts']
    }));
    writeFileSync(join(snapshot, 'src', 'probe.ts'), [
      'export const unsafe: string = JSON.parse(\'"value"\');',
      'document.createElement("style");'
    ].join('\n'));

    if (withPrivateExclusions) {
      mkdirSync(join(snapshot, 'scripts'));
      writeFileSync(join(snapshot, 'scripts', 'release-exclude.txt'), [
        '  # Private fixture paths',
        '',
        '  skills/  ',
        '  src/api/externalAPIManager.ts  ',
        ''
      ].join('\n'));
      mkdirSync(join(snapshot, 'src', 'api'));
      // This private source is intentionally invalid: a scan must exclude it.
      writeFileSync(join(snapshot, 'src', 'api', 'externalAPIManager.ts'), 'not valid TypeScript!');
    }

    writeFileSync(join(snapshot, 'scan.config.mjs'), `
      import { ESLint } from 'eslint';
      const eslint = new ESLint({ cwd: process.cwd() });
      const results = await eslint.lintFiles(['src/']);
      const paths = [
        'src/probe.ts',
        'main.js',
        'tests/example.test.ts',
        'skills/example.ts',
        'src/api/externalAPIManager.ts'
      ];
      const ignored = Object.fromEntries(await Promise.all(
        paths.map(async (path) => [path, await eslint.isPathIgnored(path)])
      ));
      process.stdout.write(JSON.stringify({
        messages: results.flatMap((result) => result.messages),
        ignored
      }));
    `);

    const result = spawnSync(process.execPath, ['scan.config.mjs'], {
      cwd: snapshot,
      encoding: 'utf8',
      timeout: 30000
    });
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    return JSON.parse(result.stdout) as ScanReport;
  } finally {
    rmSync(snapshot, { recursive: true, force: true });
  }
}

test('public snapshot without private release exclusions retains typechecked and Obsidian checks', () => {
  const report = scanSnapshot(false);

  expect(report.messages.some(message => message.fatal)).toBe(false);
  expect(report.messages.map(message => message.ruleId)).toEqual(expect.arrayContaining([
    '@typescript-eslint/no-unsafe-assignment',
    'obsidianmd/no-forbidden-elements'
  ]));
  expect(report.ignored['src/probe.ts']).toBe(false);
  expect(report.ignored['main.js']).toBe(true);
  expect(report.ignored['tests/example.test.ts']).toBe(true);
}, 30000);

test('private workspace honors release exclusions for files and directories', () => {
  const report = scanSnapshot(true);

  expect(report.messages.some(message => message.fatal)).toBe(false);
  expect(report.messages.map(message => message.ruleId)).toContain('@typescript-eslint/no-unsafe-assignment');
  expect(report.ignored['src/probe.ts']).toBe(false);
  expect(report.ignored['skills/example.ts']).toBe(true);
  expect(report.ignored['src/api/externalAPIManager.ts']).toBe(true);
}, 30000);

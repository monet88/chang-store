import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGETS = {
  portable: { suffix: '-portable.exe', label: 'Portable Windows executable' },
  nsis:     { suffix: '-setup.exe',    label: 'NSIS installer' },
};

const target = process.argv[2];
if (!TARGETS[target]) {
  console.error(`Usage: node build-win.mjs <${Object.keys(TARGETS).join('|')}>`);
  process.exit(1);
}

const { suffix, label } = TARGETS[target];
const root = fileURLToPath(new URL('../', import.meta.url));
const temporaryOutput = path.join(tmpdir(), `chang-store-release-win-${target}`);
const releaseDir = path.join(root, 'release');
const electronBuilder = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
const electronBuilderPath = path.join(root, 'node_modules', '.bin', electronBuilder);

rmSync(temporaryOutput, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });

for (const name of readdirSync(releaseDir)) {
  if (name.endsWith(suffix) || name.endsWith(`${suffix}.blockmap`)) {
    rmSync(path.join(releaseDir, name), { force: true });
  }
}

console.log(`Building ${label} with electron-builder...`);
const build = spawnSync(
  electronBuilderPath,
  ['--win', target, '--x64', `--config.directories.output=${temporaryOutput}`],
  { cwd: root, stdio: 'inherit', shell: true }
);

if (build.status !== 0) {
  process.exit(build.status || 1);
}

const artifacts = readdirSync(temporaryOutput)
  .filter(name => name.endsWith(suffix) || name.endsWith(`${suffix}.blockmap`));

if (!artifacts.some(name => name.endsWith(suffix) && !name.endsWith('.blockmap'))) {
  console.error(`Windows build completed without producing a ${suffix} artifact.`);
  process.exit(1);
}

for (const artifact of artifacts) {
  cpSync(path.join(temporaryOutput, artifact), path.join(releaseDir, artifact));
}

rmSync(temporaryOutput, { recursive: true, force: true });
console.log(`\n${label} ready in: ${releaseDir}`);

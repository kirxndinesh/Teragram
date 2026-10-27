const { existsSync } = require('node:fs');
const { spawn } = require('node:child_process');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const mode = process.argv[2];
if (!['dev', 'build'].includes(mode)) {
  console.error('Usage: node scripts/tg-drive.cjs dev|build');
  process.exit(1);
}
// Keep native files and OS credentials in the same isolated profile. Never
// accept arbitrary identity overrides through this convenient launcher.
const env = { ...process.env };
const localTools = path.resolve(appRoot, '..', '.build-tools');
const localCargo = path.join(localTools, 'cargo');
if (existsSync(path.join(localCargo, 'bin', process.platform === 'win32' ? 'rustup.exe' : 'rustup'))) {
  env.CARGO_HOME = localCargo;
  env.RUSTUP_HOME = path.join(localTools, 'rustup');
  env.PATH = `${path.join(localCargo, 'bin')}${path.delimiter}${env.PATH || ''}`;
}
const args = [path.join(__dirname, 'tauri-cli.cjs'), mode,
  '--features', 'tg-drive-local', '--config', 'src-tauri/tauri.tg-drive.conf.json'];
if (mode === 'build') {
  args.push('--debug');
  if (process.platform === 'darwin') args.push('--bundles', 'app');
}
const child = spawn(process.execPath, args, { cwd: appRoot, env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));

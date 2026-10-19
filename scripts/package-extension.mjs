// Zips dist/ into release/devdeck-<version>.zip for the Chrome Web Store.
// Run after `npm run build` (npm run package does both).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.json'), 'utf8'));
mkdirSync('release', { recursive: true });
const out = resolve('release', `devdeck-${manifest.version}.zip`);
if (existsSync(out)) rmSync(out);

// bsdtar (built into Windows 10+ and macOS) writes forward-slash paths, which
// the Web Store needs; PowerShell's Compress-Archive writes backslashes.
if (process.platform === 'linux') execFileSync('zip', ['-qr', out, '.'], { cwd: dist, stdio: 'inherit' });
else execFileSync(process.platform === 'win32' ? resolve(process.env.SystemRoot ?? 'C:/Windows', 'System32/tar.exe') : 'tar', ['-a', '-c', '-f', out, ...readdirSync(dist)], { cwd: dist, stdio: 'inherit' });
console.log(`Packaged ${manifest.name} ${manifest.version} → ${out}`);

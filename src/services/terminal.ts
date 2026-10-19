// The terminal box: commands run in a real terminal window on the user's
// computer — PowerShell on Windows, the default terminal on Linux / macOS —
// optionally as administrator (UAC on Windows, sudo elsewhere).
//
// Browsers cannot start programs, so this goes through Chrome native
// messaging to a tiny desktop helper ("com.devdeck.terminal") that the user
// installs once from Settings → Profile. The helper only accepts messages from
// this extension (allowed_origins), opens a new terminal window and runs the
// command there, visibly. Nothing runs in the background.

import { isExtension } from '../lib/env';

export const HOST_NAME = 'com.devdeck.terminal';

type Platform = 'windows' | 'mac' | 'linux';

interface ChromeNative {
  runtime?: {
    id?: string;
    lastError?: { message?: string };
    sendNativeMessage?: (host: string, msg: unknown, cb: (res: unknown) => void) => void;
  };
}

export type TerminalResult =
  | { ok: true }
  | { ok: false; reason: 'not-extension' | 'no-helper' | 'error'; message: string };

function native(message: unknown): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const chrome = (globalThis as { chrome?: ChromeNative }).chrome;
  return new Promise((resolve, reject) => {
    const send = chrome?.runtime?.sendNativeMessage;
    if (!send) return reject(new Error('Native messaging unavailable'));
    send.call(chrome!.runtime, HOST_NAME, message, (res) => {
      const err = chrome?.runtime?.lastError;
      if (err) reject(new Error(err.message ?? 'Native host error'));
      else resolve((res ?? { ok: false, error: 'No reply from the helper' }) as { ok: boolean; error?: string });
    });
  });
}

const NO_HELPER = /not found|not installed|specified native messaging host|forbidden|exited|disconnect/i;

export async function runInTerminal(cmd: string, admin: boolean): Promise<TerminalResult> {
  if (!isExtension()) {
    return { ok: false, reason: 'not-extension', message: 'This page is not running as the installed DevDeck extension (e.g. opened from localhost), so it cannot reach the desktop helper. Commands run from the extension’s new tab once the helper is set up.' };
  }
  try {
    const res = await native({ cmd, admin });
    return res.ok ? { ok: true } : { ok: false, reason: 'error', message: String(res.error ?? 'The command could not start') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NO_HELPER.test(message)
      ? { ok: false, reason: 'no-helper', message: 'The desktop helper is not installed yet — set it up in Settings → Profile.' }
      : { ok: false, reason: 'error', message };
  }
}

export async function pingHelper(): Promise<{ ok: boolean; message: string }> {
  if (!isExtension()) return { ok: false, message: 'Only available in the DevDeck extension.' };
  try {
    const res = await native({ ping: true });
    return res.ok ? { ok: true, message: `Connected (${String(res.platform ?? 'helper')})` } : { ok: false, message: String(res.error) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export const extensionId = () => (globalThis as { chrome?: ChromeNative }).chrome?.runtime?.id ?? 'YOUR-EXTENSION-ID';

// ---- Installer generation -------------------------------------------------------
// One self-contained script per OS, with this extension's ID filled in.

const PS_HOST = String.raw`$ErrorActionPreference = 'Stop'
$stdin = [Console]::OpenStandardInput()
$stdout = [Console]::OpenStandardOutput()
function Read-Message {
  $len = New-Object byte[] 4
  if ($stdin.Read($len, 0, 4) -lt 4) { return $null }
  $size = [BitConverter]::ToInt32($len, 0)
  $buf = New-Object byte[] $size
  $read = 0
  while ($read -lt $size) {
    $r = $stdin.Read($buf, $read, $size - $read)
    if ($r -le 0) { break }
    $read += $r
  }
  return ([Text.Encoding]::UTF8.GetString($buf, 0, $read) | ConvertFrom-Json)
}
function Send-Message($obj) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))
  $stdout.Write([BitConverter]::GetBytes([int]$bytes.Length), 0, 4)
  $stdout.Write($bytes, 0, $bytes.Length)
  $stdout.Flush()
}
$msg = Read-Message
if ($null -eq $msg) { exit 0 }
if ($msg.ping) { Send-Message @{ ok = $true; version = 1; platform = 'windows' }; exit 0 }
$cmd = [string]$msg.cmd
if (-not $cmd.Trim()) { Send-Message @{ ok = $false; error = 'Empty command' }; exit 0 }
# -EncodedCommand avoids every quoting problem.
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
$psArgs = @('-NoExit', '-NoLogo', '-EncodedCommand', $encoded)
try {
  if ($msg.admin) { Start-Process powershell -Verb RunAs -ArgumentList $psArgs -WorkingDirectory $HOME }
  else { Start-Process powershell -ArgumentList $psArgs -WorkingDirectory $HOME }
  Send-Message @{ ok = $true }
} catch {
  Send-Message @{ ok = $false; error = $_.Exception.Message }
}
`;

const BAT_HOST = String.raw`@echo off
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0devdeck-terminal.ps1"
`;

const PY_HOST = String.raw`#!/usr/bin/env python3
# DevDeck terminal helper: opens a terminal window and runs the command sent
# by the DevDeck extension (Chrome native messaging).
import json, shutil, struct, subprocess, sys

def read():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    size = struct.unpack('<I', raw)[0]
    return json.loads(sys.stdin.buffer.read(size).decode('utf-8'))

def send(obj):
    data = json.dumps(obj).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()

msg = read()
if msg is None:
    sys.exit(0)
if msg.get('ping'):
    send({'ok': True, 'version': 1, 'platform': sys.platform})
    sys.exit(0)
cmd = str(msg.get('cmd', '')).strip()
if not cmd:
    send({'ok': False, 'error': 'Empty command'})
    sys.exit(0)
if msg.get('admin'):
    cmd = 'sudo ' + cmd
try:
    if sys.platform == 'darwin':
        subprocess.Popen(['osascript', '-e', 'tell application "Terminal"', '-e', 'activate', '-e', 'do script ' + json.dumps(cmd), '-e', 'end tell'])
    else:
        script = cmd + '; exec "$SHELL" -l'
        terminals = [('x-terminal-emulator', ['-e']), ('gnome-terminal', ['--']), ('konsole', ['-e']),
                     ('xfce4-terminal', ['-x']), ('kitty', []), ('alacritty', ['-e']), ('xterm', ['-e'])]
        for name, flag in terminals:
            if shutil.which(name):
                subprocess.Popen([name] + flag + ['bash', '-lc', script], start_new_session=True)
                break
        else:
            send({'ok': False, 'error': 'No terminal emulator found'})
            sys.exit(0)
    send({'ok': True})
except Exception as exc:
    send({'ok': False, 'error': str(exc)})
`;

export function buildInstaller(platform: Platform, extId: string): { filename: string; content: string; run: string } {
  const origin = `chrome-extension://${extId}/`;
  if (platform === 'windows') {
    const content = [
      '# DevDeck terminal helper — installer (current user only, no admin needed).',
      "$ErrorActionPreference = 'Stop'",
      "$dir = Join-Path $env:LOCALAPPDATA 'DevDeck\\terminal-host'",
      'New-Item -ItemType Directory -Force -Path $dir | Out-Null',
      "[IO.File]::WriteAllText((Join-Path $dir 'devdeck-terminal.ps1'), @'",
      PS_HOST.trimEnd(),
      "'@)",
      "[IO.File]::WriteAllText((Join-Path $dir 'devdeck-terminal.bat'), @'",
      BAT_HOST.trimEnd(),
      "'@)",
      `$manifest = @{ name = '${HOST_NAME}'; description = 'DevDeck terminal helper'; path = (Join-Path $dir 'devdeck-terminal.bat'); type = 'stdio'; allowed_origins = @('${origin}') } | ConvertTo-Json`,
      `$mpath = Join-Path $dir '${HOST_NAME}.json'`,
      '[IO.File]::WriteAllText($mpath, $manifest)',
      `foreach ($browser in 'Google\\Chrome', 'Microsoft\\Edge', 'BraveSoftware\\Brave-Browser', 'Chromium') {`,
      `  $key = "HKCU:\\Software\\$browser\\NativeMessagingHosts\\${HOST_NAME}"`,
      '  New-Item -Path $key -Force | Out-Null',
      "  Set-ItemProperty -Path $key -Name '(default)' -Value $mpath",
      '}',
      "Write-Host 'DevDeck terminal helper installed. Back in DevDeck, press Test in Settings -> Profile.' -ForegroundColor Green",
      "Read-Host 'Press Enter to close'",
      '',
    ].join('\r\n');
    return {
      filename: 'devdeck-terminal-setup.ps1',
      content,
      run: 'powershell -ExecutionPolicy Bypass -File "$HOME\\Downloads\\devdeck-terminal-setup.ps1"',
    };
  }
  const manifest = JSON.stringify({ name: HOST_NAME, description: 'DevDeck terminal helper', path: '__PATH__', type: 'stdio', allowed_origins: [origin] });
  const content = [
    '#!/bin/sh',
    '# DevDeck terminal helper — installer (current user only).',
    'set -e',
    'DIR="$HOME/.local/share/devdeck-terminal"',
    'mkdir -p "$DIR"',
    "cat > \"$DIR/devdeck-terminal.py\" <<'PYEOF'",
    PY_HOST.trimEnd(),
    'PYEOF',
    'chmod +x "$DIR/devdeck-terminal.py"',
    `MANIFEST=$(printf '%s' '${manifest}' | sed "s|__PATH__|$DIR/devdeck-terminal.py|")`,
    'write_manifest() { mkdir -p "$1/NativeMessagingHosts"; printf \'%s\\n\' "$MANIFEST" > "$1/NativeMessagingHosts/' + HOST_NAME + '.json"; }',
    'if [ "$(uname)" = "Darwin" ]; then',
    '  for d in "Google/Chrome" "Chromium" "BraveSoftware/Brave-Browser" "Microsoft Edge"; do write_manifest "$HOME/Library/Application Support/$d"; done',
    'else',
    '  for d in "google-chrome" "chromium" "BraveSoftware/Brave-Browser" "microsoft-edge"; do write_manifest "$HOME/.config/$d"; done',
    'fi',
    'echo "DevDeck terminal helper installed. Back in DevDeck, press Test in Settings -> Profile."',
    '',
  ].join('\n');
  return { filename: 'devdeck-terminal-setup.sh', content, run: 'sh ~/Downloads/devdeck-terminal-setup.sh' };
}

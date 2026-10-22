import { useMemo, useState } from 'react';
import { isExtension } from '../../lib/env';
import { detectPlatform } from '../../services/commands';
import { buildInstaller, extensionId, pingHelper } from '../../services/terminal';

// Settings → Profile: one-time setup for the terminal box. Browsers cannot
// start programs, so a tiny desktop helper (installed for this user only)
// opens the terminal window. The installer is generated here with this
// extension's ID, so only DevDeck can talk to it.

export function TerminalHelper() {
  const platform = useMemo(() => detectPlatform(), []);
  const installer = useMemo(() => buildInstaller(platform, extensionId()), [platform]);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const ext = isExtension();

  const download = () => {
    const blob = new Blob([installer.content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = installer.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(installer.run);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // the command stays visible to copy by hand
    }
  };

  return (
    <section aria-label="Terminal helper" className="set-card space-y-4 rounded-2xl border p-5">
      <div>
        <span className="set-card-title block text-[13.5px] font-semibold">Terminal helper</span>
        <p className="set-card-hint mt-0.5 text-[12px] leading-relaxed">
          Commands typed in the terminal box open in {platform === 'windows' ? 'PowerShell' : 'your terminal'}; the admin toggle
          runs them {platform === 'windows' ? 'as administrator (Windows asks first)' : 'with sudo'}. Browsers can’t start
          programs, so this needs a small helper, installed once for your user only.
        </p>
      </div>
      {!ext ? (
        <p className="text-[11px] text-amber-300">Available in the DevDeck browser extension — not on the website.</p>
      ) : (
        <ol className="space-y-2.5 text-xs text-white/80">
          <li className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-white/45">1</span>
            <button type="button" onClick={download} className="btn-secondary rounded-lg border px-3 py-1.5 font-semibold">
              Download {installer.filename}
            </button>
          </li>
          <li className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2">
              <span className="font-mono text-white/45">2</span>
              Run it {platform === 'windows' ? '(Win + R or a PowerShell window)' : 'in a terminal'}:
            </span>
            <span className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-black/30 px-2 py-1 font-mono text-[11px] text-cyan-300" title={installer.run}>
                {installer.run}
              </code>
              <button type="button" onClick={copy} className="btn-secondary shrink-0 rounded-md border px-2 py-1 text-[11px]">
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </span>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-white/45">3</span>
            <button type="button" onClick={async () => setStatus(await pingHelper())} className="btn-secondary rounded-lg border px-3 py-1.5 font-semibold">
              Test
            </button>
            {status && (
              <span role="status" className={status.ok ? 'text-emerald-300' : 'text-red-300'}>
                {status.ok ? `✓ ${status.message}` : status.message}
              </span>
            )}
          </li>
        </ol>
      )}
    </section>
  );
}

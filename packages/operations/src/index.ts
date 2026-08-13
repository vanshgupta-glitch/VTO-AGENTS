/**
 * @vto-swarm/operations — THE ALLOWLIST (the only path outward, D-006).
 *
 * A fixed union of named operations. Agents request `{op:'build'}` etc. — never arbitrary shell.
 * git commit/push is NOT here (human-gated, D-008); prod deploy is out (D-028) — only dev store.
 *
 * cwd note: the spawn cwd is passed with BACKSLASHES (Windows CreateProcess ignores a
 * forward-slash cwd, which made `shopify` fall back to C:\ and fail to find the app toml).
 */
import { spawn } from 'node:child_process';

export type Operation =
  | { op: 'build'; file?: string }
  | { op: 'lint'; file: string }
  | { op: 'test' }
  | { op: 'deploy'; config?: string }
  | { op: 'video'; url: string; password: string; trigger?: string; seconds?: number; only?: string }
  | { op: 'accuracy' };

export interface OpConfig {
  repoPath: string;
  storeUrl?: string;
  storePassword?: string;
}

export interface OpResult {
  ok: boolean;
  op: string;
  summary: string;
  tail: string;
  durationMs: number;
}

const DEFAULT_FILE = 'packages/vto-core/src/engine/landmark-debug-engine.ts';
const tail = (s: string, n = 3500): string => (s.length > n ? s.slice(-n) : s);
const bs = (p: string): string => p.replace(/\//g, '\\');

/** Run a PowerShell command with a reliable (backslash) cwd. Never throws. */
function runPwsh(cmd: string, cwd: string, timeoutMs: number): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], {
      cwd: bs(cwd),
      windowsHide: true,
    });
    let out = '';
    const cap = (b: Buffer): void => {
      out += b.toString('utf8');
      if (out.length > 2_000_000) out = out.slice(-2_000_000);
    };
    child.stdout.on('data', cap);
    child.stderr.on('data', cap);
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: 124, out: `${out}\n[operation timeout after ${timeoutMs}ms]` });
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, out });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: 1, out: `${out}\n${(e as Error).message}` });
    });
  });
}

/** Run a named operation. Never throws — failures come back as { ok:false }. */
export async function execute(op: Operation, cfg: OpConfig): Promise<OpResult> {
  const t0 = Date.now();
  const repo = cfg.repoPath;
  const done = (ok: boolean, summary: string, out: string): OpResult => ({
    ok,
    op: op.op,
    summary,
    tail: tail(out),
    durationMs: Date.now() - t0,
  });

  switch (op.op) {
    case 'build': {
      const f = op.file ?? DEFAULT_FILE;
      const cmd = `cd "${repo}/packages/vto-core"; npx tsc -b; if ($?) { Write-Output TSC_OK; cd "${repo}"; npx eslint ${f}; if ($?) { Write-Output ESLINT_OK; pnpm --filter @nmg-vto/vto-widget build } }`;
      const { out } = await runPwsh(cmd, repo, 300_000);
      const ok = out.includes('TSC_OK') && out.includes('ESLINT_OK') && /built in/.test(out);
      return done(ok, ok ? 'build OK (tsc + eslint + widget)' : 'build FAILED', out);
    }
    case 'lint': {
      const cmd = `cd "${repo}"; npx eslint ${op.file}`;
      const { code, out } = await runPwsh(cmd, repo, 120_000);
      return done(code === 0, code === 0 ? 'lint clean' : 'lint errors', out);
    }
    case 'test': {
      const cmd = `cd "${repo}"; npm run test:unit`;
      const { code, out } = await runPwsh(cmd, repo, 240_000);
      return done(code === 0, code === 0 ? 'unit tests passed' : 'unit tests FAILED', out);
    }
    case 'deploy': {
      // Use --path (cwd-independent). shopify runs node via shopify.ps1 and resolves the app dir
      // from the process cwd, which Node's spawn + PowerShell Set-Location don't reliably set on
      // Windows (it fell back to C:\). --path sidesteps the whole cwd problem.
      const cmd = `$env:CI=1; shopify app deploy --path "${bs(repo)}" --config ${op.config ?? 'vto-phase1'} --allow-updates`;
      const { out } = await runPwsh(cmd, repo, 400_000);
      const ok = /New version/.test(out);
      const m = out.match(/vto-phase1-\d+/);
      return done(ok, ok ? `deployed ${m ? m[0] : '(dev store)'}` : 'deploy FAILED', out);
    }
    case 'video': {
      const only = op.only ? ` --only ${op.only}` : '';
      const cmd = `cd "${repo}/tools/video-test"; python run_video_test.py --url "${op.url}" --password ${op.password} --trigger "${op.trigger ?? 'button.vto-try-on__button'}" --seconds ${op.seconds ?? 20}${only}`;
      const { out } = await runPwsh(cmd, repo, 600_000);
      const ok = out.includes('VIDEO UI-TEST SUMMARY');
      const summ = out.match(/=== VIDEO UI-TEST SUMMARY ===[\s\S]*?OVERALL: \w+/);
      return done(ok, ok ? (summ ? summ[0] : 'video ran') : 'video FAILED', out);
    }
    case 'accuracy': {
      const cmd = `cd "${repo}/tools/video-test"; python accuracy.py --logs-dir logs`;
      const { out } = await runPwsh(cmd, repo, 120_000);
      const line = out.match(/accuracy=.*$/m);
      const ok = /accuracy=/.test(out);
      return done(ok, ok ? (line ? line[0] : 'accuracy computed') : 'accuracy FAILED', out);
    }
    default:
      return done(false, 'unknown operation', '');
  }
}

# Swarm I/O Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the VTO swarm two working entry points — Slack `@VTO-Admin` and `swarm ask` from Claude Code — sharing one dispatch core, with Slack as the communication bus and Agent OS as a passive per-agent log store.

**Architecture:** A single Node daemon (`apps/bridge`) owns all Slack I/O. A transport-blind `dispatch.ts` core spawns runtime CLIs per `config/runtimes.yaml` and writes every event to two sinks. Slack is the only human-facing channel; Agent OS reads log files it already tails and is never in the request path.

**Tech Stack:** Node 24, TypeScript 5.6 (ESM, NodeNext, strict), pnpm 9.12.0 workspace, `@slack/socket-mode` + `@slack/web-api`, `node:test` (built in — no test-runner dependency), `js-yaml`, `zod`.

**Spec:** [`doc/superpowers/specs/2026-08-12-swarm-io-wiring-design.md`](../specs/2026-08-12-swarm-io-wiring-design.md)

## Global Constraints

- **Node >= 24**, pnpm `9.12.0`, TypeScript ESM `module: NodeNext`, `strict: true`. Match `apps/cli/tsconfig.json` exactly.
- **Never automate git.** `swarm.config.yaml` `never_run: ["git commit", "git push", "git merge", "git rebase", "git reset --hard"]`. The daemon must never invoke git.
- **Never log a secret.** Redaction happens at the sink, not by instruction. Patterns: `xox[baprs]-…`, `xapp-…`, `sk-…`.
- **Slack must be acknowledged within 3 seconds.** Work happens after the ack, never before.
- **No file under `agent-os/source/` may be modified.** Agent OS updates replace app code; anything written there is lost. Integration is via `~/.agentic-os/config.json` only.
- **ASCII-only** in any text rendered into a Hermes profile — `tools/setup.py` `ascii_fold()` exists because Hermes silently drops a `SOUL.md` it cannot decode as cp1252.
- **Task header separator is U+00B7 MIDDLE DOT** (`·`), never a hyphen: `[T007 · loop 0 · stage=decompose]`.
- **`config/.secrets.env` is git-ignored** and must never be committed, echoed, or posted.
- Tier 1 (`claude`) keeps `context_policy: documents-only` and `tier1_allow_message_history: false`. This plan does not touch Tier 1 context assembly.

---

## File Structure

**New — `apps/bridge/`** (the daemon; one responsibility per file)

| File | Responsibility |
|---|---|
| `package.json` | Workspace member `vto-bridge`, deps, scripts |
| `tsconfig.json` | Copy of `apps/cli/tsconfig.json` |
| `src/config.ts` | Load + validate the four YAML configs and `.secrets.env`. Fail fast. |
| `src/log.ts` | The two sinks and redaction. Only writer of log files. |
| `src/header.ts` | Task-ID allocation and `[T### · loop N · stage=X]` parse/format |
| `src/runtimes.ts` | Spawn a runtime CLI per `runtimes.yaml`. Prompt file, timeout, ANSI strip. |
| `src/dispatch.ts` | **The core.** Transport-blind. |
| `src/slack.ts` | Socket Mode listener + `chat.postMessage`. Only file importing `@slack/*`. |
| `src/http.ts` | Loopback HTTP for the CLI entry point |
| `src/index.ts` | Daemon entry: wire config → log → slack → http |

**New — tooling**

| File | Responsibility |
|---|---|
| `tools/localize_runtimes.py` | Regenerate `config/runtimes.yaml` from `~/.agentic-os/config.json` |
| `tools/retire_legacy_fleet.ps1` | Sweep → archive → delete the 14 legacy profiles |

**Modified**

| File | Change |
|---|---|
| `tools/setup.py` | Extend stamp/verify to `config.yaml`, closing the model-drift blind spot |
| `config/runtimes.yaml` | Regenerated with local paths |
| `config/bridge.config.yaml:155` | Fix the double-escaped task-header regex |
| `apps/cli/src/swarmctl.ts` | Add `ask` command |
| `pnpm-workspace.yaml` | Already globs `apps/*` — no change needed |

---

## Task 1: Localise runtimes.yaml and close the drift blind spot

**Files:**
- Create: `tools/localize_runtimes.py`
- Modify: `tools/setup.py` (add `config.yaml` to stamp/verify)
- Modify: `config/runtimes.yaml` (regenerated output)

**Interfaces:**
- Consumes: `~/.agentic-os/config.json` keys `hermes`, `openclaw`, `claude`
- Produces: `config/runtimes.yaml` with valid local `bin` paths; `setup.py verify` that fails on model drift

- [ ] **Step 1: Write `tools/localize_runtimes.py`**

```python
#!/usr/bin/env python3
"""
Regenerate config/runtimes.yaml from ~/.agentic-os/config.json.

The checked-in file names C:/Users/ankur.singh paths that do not exist here.
Agent OS already records the correct local binaries, so we read them rather
than hand-editing and letting the two disagree again.

    python tools/localize_runtimes.py --check    # report, change nothing
    python tools/localize_runtimes.py --write    # rewrite runtimes.yaml
"""
import json, os, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AGENTIC = Path.home() / ".agentic-os" / "config.json"
OUT = ROOT / "config" / "runtimes.yaml"

# name -> (agentic-os config key, cmd_template, extra)
SPEC = {
    "hermes":   ("hermes",   ["-p", "{profile}", "--prompt-file", "{instruction_file}"], {}),
    "openclaw": ("openclaw", ["--agent", "{agent}", "--prompt-file", "{instruction_file}"], {}),
    "opencode": (None,       ["run", "{message}", "-m", "{model}"], {"strip_ansi": True}),
    "claude":   ("claude",   ["-p", "{instruction}", "--model", "{model}"], {}),
    "python":   (None,       [], {}),
}


def resolve(name, key):
    """Agent OS config first, then PATH. Returns an absolute path or None."""
    if key and AGENTIC.is_file():
        try:
            v = json.loads(AGENTIC.read_text(encoding="utf-8")).get(key)
            if v and Path(v).exists():
                return str(Path(v)).replace("\\", "/")
        except Exception:
            pass
    if name == "python":
        return sys.executable.replace("\\", "/")
    w = shutil.which(name)
    return str(Path(w).resolve()).replace("\\", "/") if w else None


def version_of(binpath):
    try:
        r = subprocess.run([binpath, "--version"], capture_output=True,
                           text=True, timeout=30)
        return (r.stdout or r.stderr).strip().splitlines()[0] if (r.stdout or r.stderr) else ""
    except Exception:
        return ""


def build():
    lines = ["# Command templates. GENERATED by tools/localize_runtimes.py - do not hand-edit.",
             "# Absolute paths only: the name on PATH may be a shim (decision D-015).",
             "runtimes:"]
    missing = []
    for name, (key, tmpl, extra) in SPEC.items():
        b = resolve(name, key)
        if not b:
            missing.append(name)
            continue
        lines.append(f"  {name}:")
        lines.append(f"    bin: {b}")
        lines.append(f'    version_flag: "--version"')
        v = version_of(b)
        if v:
            lines.append(f'    expected_version: "{v}"')
        if tmpl:
            lines.append(f"    cmd_template: {json.dumps(tmpl)}")
        for k, val in extra.items():
            lines.append(f"    {k}: {str(val).lower()}")
    return "\n".join(lines) + "\n", missing


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "--check"
    text, missing = build()
    for m in missing:
        print(f"  [!] {m}: not found in ~/.agentic-os/config.json or on PATH")
    if mode == "--write":
        OUT.write_text(text, encoding="utf-8")
        print(f"  [ok] wrote {OUT}")
    else:
        print(text)
    sys.exit(1 if missing else 0)
```

- [ ] **Step 2: Run it in check mode and confirm every path resolves**

Run: `python tools/localize_runtimes.py --check`
Expected: five `bin:` lines, all pointing at paths under `C:/Users/vansh.gupta/`, no `[!]` lines.

- [ ] **Step 3: Write it**

Run: `python tools/localize_runtimes.py --write`
Then verify no `ankur.singh` remains:
Run: `Select-String -Path config/runtimes.yaml -Pattern "ankur"`
Expected: no output.

- [ ] **Step 4: Extend `tools/setup.py` to stamp and verify `config.yaml`**

In `cmd_plan`, replace the bare `config.yaml` write with a stamped one, and add it to `cmd_verify`. The model lives only in this file, so leaving it unhashed is why `verify` reported all-green while all four agents ran the wrong model.

```python
def compose_profile_config(aid, spec):
    """The profile's config.yaml body. Model lives HERE, so it must be hashed."""
    model = spec.get("model", "")
    if model.startswith("openrouter/"):
        provider, slug = "openrouter", model[len("openrouter/"):]
    else:
        provider, slug = "custom", model
    return f"model:\n  default: {slug}\n  provider: {provider}\n"
```

Then in `cmd_plan` where `config.yaml` is written:

```python
            cfg_body = compose_profile_config(aid, spec)
            cfg_text, cfg_sha = stamped(cfg_body, f"agents/{aid}/agent.yaml")
            (d / "config.yaml").write_text(
                cfg_text.replace("<!-- GENERATED", "# GENERATED").replace("-->", ""),
                encoding="utf-8")
```

And in `cmd_verify`, after the SOUL check, add:

```python
        c = HERMES_PROFILES / aid / "config.yaml"
        expected_cfg = compose_profile_config(aid, spec)
        _, csha = stamped(expected_cfg, f"agents/{aid}/agent.yaml")
        cm = re.search(r"sha256:([0-9a-f]+)", c.read_text(encoding="utf-8")) if c.is_file() else None
        if not cm or cm.group(1) != csha:
            say("x", f"{aid:12} config.yaml DRIFTED - model differs from registry", "r")
            bad += 1
        else:
            say("+", f"{aid:12} config.yaml matches source", "g")
```

- [ ] **Step 5: Prove the drift is now detected**

Run: `python tools/setup.py verify`
Expected: **FAIL** for all four agents on `config.yaml DRIFTED` — this is the pre-existing drift finally becoming visible. SOUL.md lines still pass.

- [ ] **Step 6: Re-apply so the registry and the live profiles agree**

Run: `python tools/setup.py apply`
Then: `python tools/setup.py verify`
Expected: all green for both `SOUL.md` and `config.yaml`.
Then confirm the models match `agent.yaml`:
Run: `Get-Content "$env:LOCALAPPDATA\hermes\profiles\admin\config.yaml"`
Expected: `default: deepseek/deepseek-v4-flash`.

- [ ] **Step 7: Commit**

```bash
git add tools/localize_runtimes.py tools/setup.py config/runtimes.yaml
git commit -m "fix: localise runtimes.yaml and verify profile config.yaml

runtimes.yaml named C:/Users/ankur.singh paths that do not exist on this
machine. Regenerated from ~/.agentic-os/config.json, which Agent OS already
maintains with correct local binaries.

setup.py verify hashed SOUL.md but not config.yaml, where the model lives.
All four profiles had drifted from the registry since cf36fc0 and verify
reported success. config.yaml is now stamped and verified too."
```

---

## Task 2: Retire the 14 legacy Hermes profiles

**Files:**
- Create: `tools/retire_legacy_fleet.ps1`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: a machine with exactly 5 Hermes profiles (`main` + the 4 swarm agents)

Sweep before archive, archive before delete. Never the reverse.

- [ ] **Step 1: Write the script**

```powershell
<#
  Retire the 14 legacy research-fleet Hermes profiles.

    .\tools\retire_legacy_fleet.ps1 -Sweep     # list unsaved work. Changes nothing.
    .\tools\retire_legacy_fleet.ps1 -Archive   # zip to _archive. Deletes nothing.
    .\tools\retire_legacy_fleet.ps1 -Delete    # remove. Refuses without an archive.

  Never touches `main` (Hermes' own default) or the four swarm profiles.
#>
param([switch]$Sweep, [switch]$Archive, [switch]$Delete)
$ErrorActionPreference = 'Stop'

$LEGACY = @('mathematics','physics','patent','medical','privacy','reconstruction',
            'device','media','competitor','fittingbox','testing','pipeline',
            'frontend','orchestrator')
$KEEP   = @('main','admin','coder','critic','researcher')
$ROOT   = Join-Path $env:LOCALAPPDATA 'hermes\profiles'
$ARCDIR = Join-Path $env:LOCALAPPDATA 'hermes\_archive'
$ZIP    = Join-Path $ARCDIR ('legacy-fleet-' + (Get-Date -Format 'yyyy-MM-dd') + '.zip')
$VAULT  = Join-Path $env:USERPROFILE 'OneDrive - NEW MEDIA GURU INDIA PVT LTD\Documents\Obsidian Vault'

function Assert-Safe {
  foreach ($k in $KEEP) {
    if ($LEGACY -contains $k) { throw "SAFETY: '$k' is in both KEEP and LEGACY" }
  }
  $running = Get-Process -Name 'hermes','python' -ErrorAction SilentlyContinue |
             Where-Object { $_.Path -like '*hermes*' }
  if ($running) { throw "Hermes processes are running. Stop them before retiring profiles." }
}

if ($Sweep) {
  Assert-Safe
  Write-Host "`nMarkdown in legacy profiles with no counterpart in the vault:`n"
  $vaultNames = @{}
  if (Test-Path $VAULT) {
    Get-ChildItem $VAULT -Recurse -File -Filter *.md -ErrorAction SilentlyContinue |
      ForEach-Object { $vaultNames[$_.Name] = $true }
  } else { Write-Host "  [!] vault not found at $VAULT - treating every .md as unsaved`n" }
  $n = 0
  foreach ($p in $LEGACY) {
    $d = Join-Path $ROOT $p
    if (-not (Test-Path $d)) { continue }
    Get-ChildItem $d -Recurse -File -Filter *.md -ErrorAction SilentlyContinue |
      Where-Object { -not $vaultNames.ContainsKey($_.Name) -and $_.Name -ne 'SOUL.md' -and $_.Name -ne 'MEMORY.md' } |
      ForEach-Object { $n++; "  {0,-14} {1}" -f $p, $_.FullName.Replace($d,'') }
  }
  if ($n -eq 0) { Write-Host "  none - every finding is already in the vault" }
  Write-Host "`n$n file(s) exist only in profile workspaces.`n"
}

if ($Archive) {
  Assert-Safe
  New-Item -ItemType Directory -Force $ARCDIR | Out-Null
  $src = $LEGACY | ForEach-Object { Join-Path $ROOT $_ } | Where-Object { Test-Path $_ }
  if (-not $src) { throw "No legacy profiles found to archive." }
  if (Test-Path $ZIP) { Remove-Item $ZIP -Force }
  Compress-Archive -Path $src -DestinationPath $ZIP -CompressionLevel Optimal
  Write-Host ("  [ok] archived {0} profiles -> {1} ({2:N0} bytes)" -f $src.Count, $ZIP, (Get-Item $ZIP).Length)
}

if ($Delete) {
  Assert-Safe
  if (-not (Test-Path $ZIP)) { throw "No archive at $ZIP. Run -Archive first." }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $z = [IO.Compression.ZipFile]::OpenRead($ZIP)
  $rootCount = ($z.Entries | ForEach-Object { ($_.FullName -split '/')[0] } | Sort-Object -Unique).Count
  $z.Dispose()
  if ($rootCount -lt 14) { throw "Archive holds only $rootCount roots, expected 14. Refusing to delete." }
  foreach ($p in $LEGACY) {
    $d = Join-Path $ROOT $p
    if (Test-Path $d) { Remove-Item $d -Recurse -Force; Write-Host "  [ok] removed $p" }
  }
  Write-Host "`nRemaining profiles:"
  Get-ChildItem $ROOT -Directory | ForEach-Object { "  " + $_.Name }
}
```

- [ ] **Step 2: Sweep and read the output**

Run: `.\tools\retire_legacy_fleet.ps1 -Sweep`
Expected: a list of `.md` files living only in profile workspaces. **Stop and show this to the user.** If anything looks like a finding, copy it into the vault before continuing.

- [ ] **Step 3: Archive**

Run: `.\tools\retire_legacy_fleet.ps1 -Archive`
Expected: `[ok] archived 14 profiles`, zip present under `%LOCALAPPDATA%\hermes\_archive\`.

- [ ] **Step 4: Delete**

Run: `.\tools\retire_legacy_fleet.ps1 -Delete`
Expected: 14 `[ok] removed` lines, then a remaining-profiles list of exactly `admin coder critic main researcher`.

- [ ] **Step 5: Confirm the swarm still resolves**

Run: `python tools/setup.py verify`
Expected: all four agents green on both files.

- [ ] **Step 6: Commit**

```bash
git add tools/retire_legacy_fleet.ps1
git commit -m "chore: add legacy fleet retirement tool

Retires the 14 research-fleet Hermes profiles superseded by the roster cut
recorded in trajectory.md but never removed at the runtime layer. Sweeps for
findings that live only in profile workspaces, archives, verifies the archive
holds 14 roots, then deletes. Refuses to delete without a verified archive
and refuses to run while Hermes processes are alive."
```

---

## Task 3: Bridge scaffold and config loader

**Files:**
- Create: `apps/bridge/package.json`, `apps/bridge/tsconfig.json`, `apps/bridge/src/config.ts`
- Test: `apps/bridge/src/config.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SwarmPaths { logDir: string; agentsDir: string; stateFile: string }
  export interface BridgeConfig {
    channels: Map<string, string>;      // name -> C0… id
    agents: Map<string, AgentSpec>;
    control: { humanGateChannel: string; neverRun: string[]; runTimeoutSeconds: number };
    paths: SwarmPaths;
    secrets: Map<string, string>;
  }
  export interface AgentSpec {
    id: string; runtime: string; model: string; tokenEnv: string; primaryChannel: string;
  }
  export function loadConfig(root?: string): BridgeConfig;  // throws on invalid
  ```

- [ ] **Step 1: Create `apps/bridge/package.json`**

```json
{
  "name": "vto-bridge",
  "version": "3.0.0",
  "private": true,
  "type": "module",
  "bin": { "vto-bridge": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "test": "tsx --test src/*.test.ts"
  },
  "dependencies": {
    "@slack/socket-mode": "^2.0.0",
    "@slack/web-api": "^7.0.0",
    "js-yaml": "^4.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `apps/bridge/tsconfig.json`** — byte-identical to `apps/cli/tsconfig.json`.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: `apps/bridge/node_modules` and `apps/cli/node_modules` both created. Network required.

- [ ] **Step 4: Write the failing test**

```ts
// apps/bridge/src/config.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from './config.js';

test('loads all 13 channels with their IDs', () => {
  const c = loadConfig();
  assert.equal(c.channels.size, 13);
  assert.match(c.channels.get('swarm-command')!, /^C0/);
});

test('loads the six agents from the registry', () => {
  const c = loadConfig();
  assert.equal(c.agents.size, 6);
  assert.equal(c.agents.get('admin')!.runtime, 'hermes');
  assert.equal(c.agents.get('admin')!.tokenEnv, 'SLACK_BOT_ADMIN');
});

test('exposes never_run so the daemon can refuse git', () => {
  const c = loadConfig();
  assert.ok(c.control.neverRun.some(x => x.startsWith('git commit')));
});

test('paths point inside ~/.agentic-os/swarm-logs', () => {
  const c = loadConfig();
  assert.match(c.paths.logDir.replace(/\\/g, '/'), /\.agentic-os\/swarm-logs$/);
});
```

- [ ] **Step 5: Run it and watch it fail**

Run: `cd apps/bridge; pnpm test`
Expected: FAIL — `Cannot find module './config.js'`.

- [ ] **Step 6: Implement `apps/bridge/src/config.ts`**

```ts
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import * as yaml from 'js-yaml';

export interface SwarmPaths { logDir: string; agentsDir: string; stateFile: string }
export interface AgentSpec {
  id: string; runtime: string; model: string; tokenEnv: string; primaryChannel: string;
}
export interface BridgeConfig {
  root: string;
  channels: Map<string, string>;
  agents: Map<string, AgentSpec>;
  control: { humanGateChannel: string; neverRun: string[]; runTimeoutSeconds: number };
  paths: SwarmPaths;
  secrets: Map<string, string>;
}

/** `.env`-style parser. Values are never logged; callers must not print them. */
function parseEnvFile(path: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    out.set(t.slice(0, i).trim(), t.slice(i + 1).trim().replace(/^["']|["']$/g, ''));
  }
  return out;
}

/** Minimal reader for the flat `key: value` agent.yaml files. */
function readAgentYaml(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(line);
    if (m && m[2]) out[m[1]] = m[2].trim();
  }
  return out;
}

export function loadConfig(root = resolve(process.cwd(), '..', '..')): BridgeConfig {
  const cfgDir = join(root, 'config');
  const need = (f: string) => {
    const p = join(cfgDir, f);
    if (!existsSync(p)) throw new Error(`missing config: ${p}`);
    return p;
  };

  const channelsDoc = yaml.load(readFileSync(need('channels.yaml'), 'utf8')) as
    { channels: Array<{ name: string; id?: string }> };
  const channels = new Map<string, string>();
  for (const ch of channelsDoc.channels ?? []) {
    if (!ch.id) throw new Error(`channel ${ch.name} has no id — run swarmctl bootstrap ids`);
    channels.set(ch.name, ch.id);
  }

  const swarm = yaml.load(readFileSync(need('swarm.config.yaml'), 'utf8')) as any;

  const agents = new Map<string, AgentSpec>();
  const agentsDir = join(root, 'agents');
  for (const d of readdirSync(agentsDir)) {
    if (d === '_template') continue;
    const f = join(agentsDir, d, 'agent.yaml');
    if (!existsSync(f)) continue;
    const y = readAgentYaml(f);
    if (y.enabled === 'false') continue;
    agents.set(d, {
      id: d,
      runtime: y.runtime ?? '',
      model: y.model ?? '',
      tokenEnv: y.token_env ?? '',
      primaryChannel: y.primary_channel ?? '',
    });
  }

  const logDir = join(homedir(), '.agentic-os', 'swarm-logs');
  return {
    root,
    channels,
    agents,
    control: {
      humanGateChannel: swarm?.control?.human_gate_channel ?? 'swarm-human-gate',
      neverRun: swarm?.control?.never_run ?? [],
      runTimeoutSeconds: swarm?.concurrency?.run_timeout_seconds ?? 900,
    },
    paths: { logDir, agentsDir: join(logDir, 'agents'), stateFile: join(logDir, 'state.json') },
    secrets: parseEnvFile(join(cfgDir, '.secrets.env')),
  };
}
```

- [ ] **Step 7: Run the tests**

Run: `cd apps/bridge; pnpm test`
Expected: 4 passing.

- [ ] **Step 8: Commit**

```bash
git add apps/bridge/package.json apps/bridge/tsconfig.json apps/bridge/src/config.ts apps/bridge/src/config.test.ts pnpm-lock.yaml
git commit -m "feat(bridge): scaffold daemon and config loader

Loads channels, the agent registry, control limits and secrets, failing fast
on anything missing. Refuses a channel with no ID rather than discovering it
at post time."
```

---

## Task 4: Log sinks and redaction

**Files:**
- Create: `apps/bridge/src/log.ts`
- Test: `apps/bridge/src/log.test.ts`

**Interfaces:**
- Consumes: `BridgeConfig.paths` from Task 3
- Produces:
  ```ts
  export type Outcome = 'success' | 'stuck' | 'timeout' | 'error';
  export interface LogEvent {
    task: string; agent: string; origin: 'slack' | 'cli';
    stage: string; level: 'info' | 'warn' | 'err';
    channel?: string; durationMs?: number; outcome?: Outcome; message: string;
  }
  export function redact(s: string): string;
  export function createLogger(paths: SwarmPaths): { logEvent(e: LogEvent): void };
  ```

- [ ] **Step 1: Write the failing test**

```ts
// apps/bridge/src/log.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { redact, createLogger } from './log.js';

function paths() {
  const d = mkdtempSync(join(tmpdir(), 'swarmlog-'));
  return { logDir: d, agentsDir: join(d, 'agents'), stateFile: join(d, 'state.json') };
}

test('redacts slack and openai style secrets', () => {
  assert.equal(redact('token xoxb-123456789012-abcdef ok'), 'token [REDACTED] ok');
  assert.equal(redact('app xapp-1-A0-999-zz ok'), 'app [REDACTED] ok');
  assert.equal(redact('key sk-abcdefghijklmnop ok'), 'key [REDACTED] ok');
});

test('writes exactly one line to swarm.log per event', () => {
  const p = paths();
  const log = createLogger(p);
  log.logEvent({ task: 'T001', agent: 'admin', origin: 'cli', stage: 'received',
                 level: 'info', message: 'hello' });
  log.logEvent({ task: 'T001', agent: 'admin', origin: 'cli', stage: 'complete',
                 level: 'info', outcome: 'success', durationMs: 12, message: 'done' });
  const lines = readFileSync(join(p.logDir, 'swarm.log'), 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /T001/);
  assert.match(lines[0], /admin/);
});

test('writes valid JSONL per agent', () => {
  const p = paths();
  createLogger(p).logEvent({ task: 'T002', agent: 'critic', origin: 'slack',
    stage: 'complete', level: 'info', outcome: 'success', durationMs: 5, message: 'ok' });
  const f = join(p.agentsDir, 'critic.jsonl');
  assert.ok(existsSync(f));
  const row = JSON.parse(readFileSync(f, 'utf8').trim());
  assert.equal(row.task, 'T002');
  assert.equal(row.outcome, 'success');
});

test('redacts in BOTH sinks', () => {
  const p = paths();
  createLogger(p).logEvent({ task: 'T003', agent: 'admin', origin: 'cli', stage: 'complete',
    level: 'info', message: 'leaked xoxb-999999999999-secretvalue here' });
  assert.doesNotMatch(readFileSync(join(p.logDir, 'swarm.log'), 'utf8'), /secretvalue/);
  assert.doesNotMatch(readFileSync(join(p.agentsDir, 'admin.jsonl'), 'utf8'), /secretvalue/);
});

test('a sink failure never throws', () => {
  const log = createLogger({ logDir: '\u0000bad', agentsDir: '\u0000bad', stateFile: '\u0000bad' });
  assert.doesNotThrow(() => log.logEvent({ task: 'T004', agent: 'admin', origin: 'cli',
    stage: 'x', level: 'info', message: 'y' }));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/bridge; pnpm test`
Expected: FAIL — `Cannot find module './log.js'`.

- [ ] **Step 3: Implement `apps/bridge/src/log.ts`**

```ts
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SwarmPaths } from './config.js';

export type Outcome = 'success' | 'stuck' | 'timeout' | 'error';

export interface LogEvent {
  task: string;
  agent: string;
  origin: 'slack' | 'cli';
  stage: string;
  level: 'info' | 'warn' | 'err';
  channel?: string;
  durationMs?: number;
  outcome?: Outcome;
  message: string;
}

// Enforcement lives here, not in the agent's prompt. setup.py tells the model
// "never print a secret", but the bridge captures that model's raw stdout and
// writes it to two files and a Slack channel — so the guarantee has to be
// mechanical at the sink.
const SECRETS = [
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /xapp-[A-Za-z0-9-]{10,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
];

export function redact(s: string): string {
  let out = s;
  for (const re of SECRETS) out = out.replace(re, '[REDACTED]');
  return out;
}

export function createLogger(paths: SwarmPaths) {
  return {
    logEvent(e: LogEvent): void {
      // A log failure must never change the outcome of a task.
      try {
        mkdirSync(paths.agentsDir, { recursive: true });
        const ts = new Date().toISOString();
        const msg = redact(e.message).replace(/\r?\n/g, ' ').slice(0, 2000);

        const line = `${ts} [${e.level.toUpperCase()}] ${e.task} ${e.agent} ` +
                     `stage=${e.stage} origin=${e.origin}` +
                     (e.outcome ? ` outcome=${e.outcome}` : '') +
                     (e.durationMs !== undefined ? ` ${e.durationMs}ms` : '') +
                     ` :: ${msg}\n`;
        appendFileSync(join(paths.logDir, 'swarm.log'), line, 'utf8');

        const row = JSON.stringify({
          ts, task: e.task, agent: e.agent, origin: e.origin, stage: e.stage,
          level: e.level, channel: e.channel, duration_ms: e.durationMs,
          outcome: e.outcome, message: msg,
        }) + '\n';
        appendFileSync(join(paths.agentsDir, `${e.agent}.jsonl`), row, 'utf8');
      } catch (err) {
        process.stderr.write(`[log] sink write failed (continuing): ${String(err)}\n`);
      }
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/bridge; pnpm test`
Expected: 9 passing (4 from config, 5 from log).

- [ ] **Step 5: Commit**

```bash
git add apps/bridge/src/log.ts apps/bridge/src/log.test.ts
git commit -m "feat(bridge): two log sinks with redaction at the sink

swarm.log is the single .log the Agent OS activity feed tails; per-agent JSONL
in agents/ is the durable archive and is invisible to that tail. Secrets are
stripped before either write, and a sink failure is logged but never fails the
run."
```

---

## Task 5: Task header — allocation, format, and the regex fix

**Files:**
- Create: `apps/bridge/src/header.ts`
- Test: `apps/bridge/src/header.test.ts`
- Modify: `config/bridge.config.yaml:155`

**Interfaces:**
- Produces:
  ```ts
  export const HEADER_RE: RegExp;
  export function formatHeader(task: string, loop: number, stage: string): string;
  export function parseHeader(s: string): { task: string; loop: number; stage: string } | null;
  export function nextTaskId(stateFile: string): string;   // "T001", "T002", …
  ```

- [ ] **Step 1: Write the failing test**

```ts
// apps/bridge/src/header.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HEADER_RE, formatHeader, parseHeader, nextTaskId } from './header.js';

test('the regex matches a real header', () => {
  // This is the test that would have caught the double-escaped pattern in
  // bridge.config.yaml:155, which could not match anything.
  assert.ok(HEADER_RE.test('[T007 \u00b7 loop 0 \u00b7 stage=decompose]'));
});

test('separator is MIDDLE DOT, not a hyphen', () => {
  assert.equal(formatHeader('T007', 0, 'decompose'), '[T007 \u00b7 loop 0 \u00b7 stage=decompose]');
  assert.equal(parseHeader('[T007 - loop 0 - stage=decompose]'), null);
});

test('round-trips', () => {
  const p = parseHeader(formatHeader('T042', 3, 'critique'));
  assert.deepEqual(p, { task: 'T042', loop: 3, stage: 'critique' });
});

test('task ids increment and persist', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'hdr-')), 'state.json');
  assert.equal(nextTaskId(f), 'T001');
  assert.equal(nextTaskId(f), 'T002');
  assert.equal(nextTaskId(f), 'T003');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/bridge; pnpm test`
Expected: FAIL — `Cannot find module './header.js'`.

- [ ] **Step 3: Implement `apps/bridge/src/header.ts`**

```ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// U+00B7 MIDDLE DOT. config/bridge.config.yaml declared this pattern
// double-escaped inside YAML single quotes, so the engine received an escaped
// literal backslash followed by an open character class and could never match.
export const HEADER_RE = /\[T(\d+) \u00b7 loop (\d+) \u00b7 stage=(\w+)\]/;

export function formatHeader(task: string, loop: number, stage: string): string {
  return `[${task} \u00b7 loop ${loop} \u00b7 stage=${stage}]`;
}

export function parseHeader(s: string): { task: string; loop: number; stage: string } | null {
  const m = HEADER_RE.exec(s);
  return m ? { task: `T${m[1]}`, loop: Number(m[2]), stage: m[3] } : null;
}

export function nextTaskId(stateFile: string): string {
  let n = 0;
  try {
    if (existsSync(stateFile)) n = JSON.parse(readFileSync(stateFile, 'utf8')).lastTask ?? 0;
  } catch { n = 0; }
  n += 1;
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ lastTask: n }), 'utf8');
  return `T${String(n).padStart(3, '0')}`;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/bridge; pnpm test`
Expected: 13 passing.

- [ ] **Step 5: Fix the config file**

In `config/bridge.config.yaml`, replace line 155:

```yaml
      pattern: '\[T(\d+) · loop (\d+) · stage=(\w+)\]'
```

- [ ] **Step 6: Commit**

```bash
git add apps/bridge/src/header.ts apps/bridge/src/header.test.ts config/bridge.config.yaml
git commit -m "fix: task-header regex could not match any header

bridge.config.yaml declared the pattern double-escaped inside YAML single
quotes, so the engine received an escaped literal backslash followed by an
open character class. With task_header.required: true, a faithful
implementation would have rejected every message. Corrected, with a test
asserting a real header matches."
```

---

## Task 6: Runtime adapter

**Files:**
- Create: `apps/bridge/src/runtimes.ts`
- Test: `apps/bridge/src/runtimes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RunResult {
    ok: boolean; stdout: string; stderr: string; code: number | null;
    durationMs: number; timedOut: boolean;
  }
  export interface Runner { run(agent: AgentSpec, prompt: string): Promise<RunResult> }
  export function createRunner(root: string, timeoutSeconds: number): Runner;
  export function stripAnsi(s: string): string;
  export function isStuck(s: string): boolean;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// apps/bridge/src/runtimes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripAnsi, isStuck } from './runtimes.js';

test('strips ANSI escapes', () => {
  assert.equal(stripAnsi('\u001b[32mok\u001b[0m'), 'ok');
});

test('detects a STUCK block in either the folded or unicode form', () => {
  // setup.py ascii-folds the soul, so agents see "[STUCK]" not the emoji.
  assert.ok(isStuck('[STUCK]\nATTEMPTED: x\nERROR: y\nRESOURCES: z\nHYPOTHESIS: w'));
  assert.ok(isStuck('\u26d4 STUCK\nATTEMPTED: x'));
  assert.equal(isStuck('all good, nothing wrong'), false);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/bridge; pnpm test`
Expected: FAIL — `Cannot find module './runtimes.js'`.

- [ ] **Step 3: Implement `apps/bridge/src/runtimes.ts`**

```ts
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as yaml from 'js-yaml';
import type { AgentSpec } from './config.js';

export interface RunResult {
  ok: boolean; stdout: string; stderr: string; code: number | null;
  durationMs: number; timedOut: boolean;
}
export interface Runner { run(agent: AgentSpec, prompt: string): Promise<RunResult> }

export function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
}

// setup.py ASCII-folds every rendered soul, so an agent emits "[STUCK]" where
// the spec writes the emoji. Both forms must be recognised.
export function isStuck(s: string): boolean {
  return /\[STUCK\]|\u26d4\s*STUCK/.test(s);
}

interface RuntimeEntry {
  bin: string;
  cmd_template?: string[];
  strip_ansi?: boolean;
}

export function createRunner(root: string, timeoutSeconds: number): Runner {
  const file = join(root, 'config', 'runtimes.yaml');
  if (!existsSync(file)) throw new Error(`missing ${file}`);
  const doc = yaml.load(readFileSync(file, 'utf8')) as { runtimes: Record<string, RuntimeEntry> };
  const runtimes = doc?.runtimes ?? {};

  return {
    async run(agent: AgentSpec, prompt: string): Promise<RunResult> {
      const rt = runtimes[agent.runtime];
      if (!rt?.bin) {
        return { ok: false, stdout: '', stderr: `no runtime '${agent.runtime}' in runtimes.yaml`,
                 code: null, durationMs: 0, timedOut: false };
      }

      const dir = mkdtempSync(join(tmpdir(), 'swarm-prompt-'));
      const promptFile = join(dir, 'instruction.txt');
      writeFileSync(promptFile, prompt, 'utf8');

      const args = (rt.cmd_template ?? []).map(a => a
        .replace('{profile}', agent.id)
        .replace('{agent}', agent.id)
        .replace('{instruction_file}', promptFile)
        .replace('{instruction}', prompt)
        .replace('{message}', prompt)
        .replace('{model}', agent.model));

      const started = Date.now();
      return await new Promise<RunResult>((resolvePromise) => {
        const child = spawn(rt.bin, args, { windowsHide: true });
        let out = '', err = '', timedOut = false;

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill();
        }, timeoutSeconds * 1000);

        child.stdout.on('data', d => { out += d.toString(); });
        child.stderr.on('data', d => { err += d.toString(); });
        child.on('error', e => {
          clearTimeout(timer);
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
          resolvePromise({ ok: false, stdout: '', stderr: String(e), code: null,
                           durationMs: Date.now() - started, timedOut: false });
        });
        child.on('close', code => {
          clearTimeout(timer);
          try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
          const clean = rt.strip_ansi ? stripAnsi(out) : out;
          resolvePromise({ ok: code === 0 && !timedOut, stdout: clean.trim(), stderr: err.trim(),
                           code, durationMs: Date.now() - started, timedOut });
        });
      });
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/bridge; pnpm test`
Expected: 15 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/bridge/src/runtimes.ts apps/bridge/src/runtimes.test.ts
git commit -m "feat(bridge): runtime adapter driven by runtimes.yaml

Spawns any of the five runtimes from its cmd_template, with a prompt file, a
timeout from swarm.config.yaml, ANSI stripping where declared, and temp
cleanup on every exit path. Recognises STUCK in both the unicode and the
ascii-folded form, since setup.py folds every rendered soul."
```

---

## Task 7: Dispatch core

**Files:**
- Create: `apps/bridge/src/dispatch.ts`
- Test: `apps/bridge/src/dispatch.test.ts`

**Interfaces:**
- Consumes: `Runner` (Task 6), logger (Task 4), `nextTaskId` (Task 5)
- Produces:
  ```ts
  export interface DispatchRequest { agent: string; text: string; origin: 'slack' | 'cli'; channel?: string }
  export interface DispatchResult { ok: boolean; taskId: string; reply: string; outcome: Outcome; error?: string }
  export function createDispatcher(deps: {
    config: BridgeConfig; runner: Runner; logger: { logEvent(e: LogEvent): void };
  }): { dispatch(req: DispatchRequest): Promise<DispatchResult> };
  ```

- [ ] **Step 1: Write the failing test**

```ts
// apps/bridge/src/dispatch.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDispatcher } from './dispatch.js';
import type { BridgeConfig } from './config.js';
import type { RunResult, Runner } from './runtimes.js';

function fixture(result: Partial<RunResult>) {
  const d = mkdtempSync(join(tmpdir(), 'disp-'));
  const config = {
    root: d,
    channels: new Map([['swarm-command', 'C01']]),
    agents: new Map([['admin', { id: 'admin', runtime: 'hermes', model: 'm',
                                 tokenEnv: 'SLACK_BOT_ADMIN', primaryChannel: 'swarm-command' }]]),
    control: { humanGateChannel: 'swarm-human-gate', neverRun: [], runTimeoutSeconds: 900 },
    paths: { logDir: d, agentsDir: join(d, 'agents'), stateFile: join(d, 'state.json') },
    secrets: new Map(),
  } as unknown as BridgeConfig;
  const runner: Runner = {
    async run() {
      return { ok: true, stdout: 'work order', stderr: '', code: 0,
               durationMs: 5, timedOut: false, ...result };
    },
  };
  const events: any[] = [];
  const logger = { logEvent: (e: any) => events.push(e) };
  return { dispatcher: createDispatcher({ config, runner, logger }), events };
}

test('happy path returns the reply and a task id', async () => {
  const { dispatcher, events } = fixture({});
  const r = await dispatcher.dispatch({ agent: 'admin', text: 'improve smoothing', origin: 'cli' });
  assert.equal(r.ok, true);
  assert.equal(r.reply, 'work order');
  assert.match(r.taskId, /^T\d{3}$/);
  assert.equal(r.outcome, 'success');
  assert.equal(events.filter(e => e.stage === 'received').length, 1);
  assert.equal(events.filter(e => e.stage === 'complete').length, 1);
});

test('unknown agent fails without spawning', async () => {
  const { dispatcher } = fixture({});
  const r = await dispatcher.dispatch({ agent: 'nobody', text: 'x', origin: 'cli' });
  assert.equal(r.ok, false);
  assert.equal(r.outcome, 'error');
  assert.match(r.error!, /unknown agent/);
});

test('a STUCK reply is reported as stuck, not success', async () => {
  const { dispatcher } = fixture({ stdout: '[STUCK]\nATTEMPTED: a\nERROR: b\nRESOURCES: c\nHYPOTHESIS: d' });
  const r = await dispatcher.dispatch({ agent: 'admin', text: 'x', origin: 'slack' });
  assert.equal(r.outcome, 'stuck');
  assert.equal(r.ok, false);
});

test('a timeout is reported as timeout', async () => {
  const { dispatcher } = fixture({ ok: false, timedOut: true, stdout: '', stderr: 'killed' });
  const r = await dispatcher.dispatch({ agent: 'admin', text: 'x', origin: 'cli' });
  assert.equal(r.outcome, 'timeout');
});

test('origin is propagated into the log', async () => {
  const { dispatcher, events } = fixture({});
  await dispatcher.dispatch({ agent: 'admin', text: 'x', origin: 'slack', channel: 'swarm-command' });
  assert.ok(events.every(e => e.origin === 'slack'));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/bridge; pnpm test`
Expected: FAIL — `Cannot find module './dispatch.js'`.

- [ ] **Step 3: Implement `apps/bridge/src/dispatch.ts`**

```ts
import type { BridgeConfig } from './config.js';
import type { Runner } from './runtimes.js';
import { isStuck } from './runtimes.js';
import type { LogEvent, Outcome } from './log.js';
import { nextTaskId, formatHeader } from './header.js';

export interface DispatchRequest {
  agent: string; text: string; origin: 'slack' | 'cli'; channel?: string;
}
export interface DispatchResult {
  ok: boolean; taskId: string; reply: string; outcome: Outcome; error?: string;
}

export function createDispatcher(deps: {
  config: BridgeConfig;
  runner: Runner;
  logger: { logEvent(e: LogEvent): void };
}) {
  const { config, runner, logger } = deps;

  return {
    async dispatch(req: DispatchRequest): Promise<DispatchResult> {
      const taskId = nextTaskId(config.paths.stateFile);
      const spec = config.agents.get(req.agent);

      if (!spec) {
        const error = `unknown agent '${req.agent}'`;
        logger.logEvent({ task: taskId, agent: req.agent, origin: req.origin, stage: 'reject',
                          level: 'err', channel: req.channel, outcome: 'error', message: error });
        return { ok: false, taskId, reply: '', outcome: 'error', error };
      }

      logger.logEvent({ task: taskId, agent: spec.id, origin: req.origin, stage: 'received',
                        level: 'info', channel: req.channel, message: req.text });

      const prompt = `${formatHeader(taskId, 0, 'decompose')}\n\n${req.text}`;
      const run = await runner.run(spec, prompt);

      let outcome: Outcome;
      if (run.timedOut) outcome = 'timeout';
      else if (isStuck(run.stdout)) outcome = 'stuck';
      else if (!run.ok) outcome = 'error';
      else outcome = 'success';

      const ok = outcome === 'success';
      logger.logEvent({
        task: taskId, agent: spec.id, origin: req.origin,
        stage: ok ? 'complete' : 'failed',
        level: ok ? 'info' : 'err',
        channel: req.channel, durationMs: run.durationMs, outcome,
        message: ok ? run.stdout : (run.stderr || run.stdout || 'no output'),
      });

      return {
        ok, taskId, reply: run.stdout, outcome,
        error: ok ? undefined : (run.stderr || `exit ${run.code}`),
      };
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/bridge; pnpm test`
Expected: 20 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/bridge/src/dispatch.ts apps/bridge/src/dispatch.test.ts
git commit -m "feat(bridge): transport-blind dispatch core

Allocates a task id, prefixes the task header, runs the agent's runtime and
classifies the outcome as success/stuck/timeout/error. Knows nothing about
Slack or HTTP, so Phase 1b routing changes what it calls rather than how
requests arrive."
```

---

## Task 8: Slack outbound

**Files:**
- Create: `apps/bridge/src/slack.ts` (outbound half), `config/.secrets.env` (user-supplied, git-ignored)
- Test: manual live check — a real post is the only meaningful proof of credentials

**Interfaces:**
- Produces:
  ```ts
  export function createSlack(config: BridgeConfig): {
    post(opts: { agent: string; channel: string; text: string; threadTs?: string }): Promise<string | null>;
    start(onMention: (m: Mention) => void): Promise<void>;   // Task 9
  };
  export interface Mention { channel: string; user: string; text: string; threadTs: string; eventId: string }
  ```

Outbound is built and proved before the listener because a token problem and a Socket Mode problem look identical from outside.

- [ ] **Step 1: Create `config/.secrets.env` from the example**

Run: `Copy-Item config/.secrets.env.example config/.secrets.env`
Then have the **user** paste the 10 `xoxb-` tokens and the `xapp-` token. Never echo the file. Confirm it is ignored:
Run: `git check-ignore -v config/.secrets.env`
Expected: a match from `.gitignore`. **If it prints nothing, stop** — the file is not ignored and must not be committed.

- [ ] **Step 2: Implement the outbound half of `apps/bridge/src/slack.ts`**

```ts
import { WebClient } from '@slack/web-api';
import type { BridgeConfig } from './config.js';

export interface Mention {
  channel: string; user: string; text: string; threadTs: string; eventId: string;
}

export function createSlack(config: BridgeConfig) {
  const clients = new Map<string, WebClient>();

  function clientFor(agent: string): WebClient {
    const cached = clients.get(agent);
    if (cached) return cached;
    const spec = config.agents.get(agent);
    const envName = spec?.tokenEnv ?? 'SLACK_BOT_ADMIN';
    const token = config.secrets.get(envName) ?? process.env[envName];
    if (!token) throw new Error(`no token for ${agent} (${envName})`);
    const c = new WebClient(token);
    clients.set(agent, c);
    return c;
  }

  return {
    /** Returns the message ts so replies can thread under it, or null on failure. */
    async post(opts: { agent: string; channel: string; text: string; threadTs?: string }) {
      const id = config.channels.get(opts.channel) ?? opts.channel;
      try {
        const res = await clientFor(opts.agent).chat.postMessage({
          channel: id,
          text: opts.text.slice(0, 3900),
          thread_ts: opts.threadTs,
          unfurl_links: false,
        });
        return (res.ts as string) ?? null;
      } catch (e) {
        // Slack being down must not take the daemon with it.
        process.stderr.write(`[slack] post failed: ${String(e)}\n`);
        return null;
      }
    },
  };
}
```

- [ ] **Step 3: Prove the credentials with a real post**

Run from `apps/bridge`:
```
pnpm tsx -e "import {loadConfig} from './src/config.js'; import {createSlack} from './src/slack.js'; const c=loadConfig(); const s=createSlack(c); s.post({agent:'admin',channel:'swarm-command',text:'bridge connectivity check'}).then(ts=>console.log('ts:',ts));"
```
Expected: a timestamp printed, and the message visible in `#swarm-command`.
If it fails with `not_in_channel`, invite the bot: `/invite @VTO-Admin` in that channel.

- [ ] **Step 4: Commit** (the secrets file is ignored and must not appear)

```bash
git add apps/bridge/src/slack.ts
git status --short   # confirm config/.secrets.env is NOT listed
git commit -m "feat(bridge): slack outbound

One WebClient per agent so every post carries that agent's identity. Channel
names resolve through channels.yaml. A failed post is logged and swallowed:
Slack being unreachable must not stop the daemon serving the CLI."
```

---

## Task 9: Slack inbound — Socket Mode, ack, dedupe

**Files:**
- Modify: `apps/bridge/src/slack.ts` (add `start`)
- Create: `apps/bridge/src/dedupe.ts`
- Test: `apps/bridge/src/dedupe.test.ts`

**Interfaces:**
- Produces: `export function createDedupe(max?: number): { seen(id: string): boolean }`

- [ ] **Step 1: Write the failing dedupe test**

```ts
// apps/bridge/src/dedupe.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDedupe } from './dedupe.js';

test('first sighting is false, second is true', () => {
  const d = createDedupe();
  assert.equal(d.seen('Ev001'), false);
  assert.equal(d.seen('Ev001'), true);
});

test('evicts oldest beyond the cap', () => {
  const d = createDedupe(2);
  d.seen('a'); d.seen('b'); d.seen('c');
  assert.equal(d.seen('a'), false);  // 'a' was evicted
  assert.equal(d.seen('c'), true);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/bridge; pnpm test`
Expected: FAIL — `Cannot find module './dedupe.js'`.

- [ ] **Step 3: Implement `apps/bridge/src/dedupe.ts`**

```ts
/**
 * Slack redelivers any event it does not see acknowledged within 3 seconds.
 * Without this, one mention is answered three times.
 */
export function createDedupe(max = 500) {
  const order: string[] = [];
  const set = new Set<string>();
  return {
    seen(id: string): boolean {
      if (set.has(id)) return true;
      set.add(id);
      order.push(id);
      while (order.length > max) {
        const old = order.shift();
        if (old !== undefined) set.delete(old);
      }
      return false;
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/bridge; pnpm test`
Expected: 22 passing.

- [ ] **Step 5: Add `start` to `apps/bridge/src/slack.ts`**

Insert the imports and add `start` to the returned object.

```ts
import { SocketModeClient } from '@slack/socket-mode';
import { createDedupe } from './dedupe.js';
```

```ts
    /** Socket Mode listener on the admin app token. Acks first, works after. */
    async start(onMention: (m: Mention) => void): Promise<void> {
      const appToken = config.secrets.get('SLACK_APP_TOKEN') ?? process.env.SLACK_APP_TOKEN;
      if (!appToken) throw new Error('SLACK_APP_TOKEN missing — the listener cannot start');
      const dedupe = createDedupe();
      const socket = new SocketModeClient({ appToken });

      socket.on('app_mention', async ({ event, body, ack }) => {
        // Ack inside the 3s window. A Hermes call takes far longer, so the
        // work MUST happen after this, never before.
        if (ack) await ack();
        const eventId = String(body?.event_id ?? event?.ts ?? '');
        if (!eventId || dedupe.seen(eventId)) return;
        onMention({
          channel: String(event.channel),
          user: String(event.user ?? ''),
          text: String(event.text ?? '').replace(/<@[A-Z0-9]+>/g, '').trim(),
          threadTs: String(event.thread_ts ?? event.ts),
          eventId,
        });
      });

      await socket.start();
    },
```

- [ ] **Step 6: Commit**

```bash
git add apps/bridge/src/slack.ts apps/bridge/src/dedupe.ts apps/bridge/src/dedupe.test.ts
git commit -m "feat(bridge): slack inbound via Socket Mode

Acks every app_mention inside the 3s window before any work starts, strips the
bot mention from the text, and drops redelivered events by event_id so a slow
Hermes call cannot cause the same request to be answered three times."
```

---

## Task 10: Loopback HTTP, daemon entry, and the `swarm ask` CLI

**Files:**
- Create: `apps/bridge/src/http.ts`, `apps/bridge/src/index.ts`
- Modify: `apps/cli/src/swarmctl.ts` (add `ask`)
- Modify: `swarm.cmd` (add an `ask` passthrough)

**Interfaces:**
- Consumes: dispatcher (Task 7), slack (Tasks 8–9)
- Produces: `POST http://127.0.0.1:8787/ask  {agent?, text}` → `{ok, taskId, reply, outcome}`

- [ ] **Step 1: Implement `apps/bridge/src/http.ts`**

```ts
import { createServer } from 'node:http';
import type { DispatchRequest, DispatchResult } from './dispatch.js';

export function startHttp(
  port: number,
  handle: (req: DispatchRequest) => Promise<DispatchResult>,
): void {
  createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/ask') {
      res.writeHead(404).end('not found');
      return;
    }
    let body = '';
    req.on('data', c => { body += c; if (body.length > 100_000) req.destroy(); });
    req.on('end', async () => {
      try {
        const { agent = 'admin', text } = JSON.parse(body || '{}');
        if (!text) { res.writeHead(400).end(JSON.stringify({ error: 'text required' })); return; }
        const out = await handle({ agent, text, origin: 'cli' });
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json' })
           .end(JSON.stringify({ error: String(e) }));
      }
    });
    // Loopback only — bound to 127.0.0.1 below, never 0.0.0.0.
  }).listen(port, '127.0.0.1');
}
```

- [ ] **Step 2: Implement `apps/bridge/src/index.ts`**

```ts
import { loadConfig } from './config.js';
import { createLogger } from './log.js';
import { createRunner } from './runtimes.js';
import { createDispatcher } from './dispatch.js';
import { createSlack } from './slack.js';
import { startHttp } from './http.js';
import { formatHeader } from './header.js';
import type { DispatchRequest } from './dispatch.js';

const PORT = Number(process.env.SWARM_BRIDGE_PORT ?? 8787);
// SWARM_DRY_RUN=1 exercises the whole path except the two things that cost
// money or leave the machine: the model spawn and the Slack post.
const DRY = process.env.SWARM_DRY_RUN === '1';

const config = loadConfig();
const logger = createLogger(config.paths);
const runner = DRY
  ? { async run() { return { ok: true, stdout: '[dry-run] no model was called',
        stderr: '', code: 0, durationMs: 0, timedOut: false }; } }
  : createRunner(config.root, config.control.runTimeoutSeconds);
const dispatcher = createDispatcher({ config, runner, logger });
const realSlack = createSlack(config);
const slack = DRY
  ? { async post(o: { channel: string; text: string }) {
        console.log(`[dry-run] slack #${o.channel}: ${o.text.slice(0, 120)}`); return 'dry.0'; },
      async start() { console.log('[dry-run] slack listener not started'); } }
  : realSlack;

/** Slack is the bus: every request appears in a channel, whatever its origin. */
async function handleCli(req: DispatchRequest) {
  const ts = await slack.post({
    agent: 'admin', channel: 'swarm-command',
    text: `_via Claude Code_ ${req.text}`,
  });
  const result = await dispatcher.dispatch({ ...req, channel: 'swarm-command' });
  await slack.post({
    agent: req.agent, channel: 'swarm-command', threadTs: ts ?? undefined,
    text: `${formatHeader(result.taskId, 0, result.ok ? 'complete' : 'failed')}\n${result.reply || result.error}`,
  });
  if (!result.ok) {
    await slack.post({ agent: 'admin', channel: 'swarm-incidents',
      text: `${formatHeader(result.taskId, 0, 'failed')} ${result.outcome}: ${result.error ?? ''}` });
  }
  return result;
}

startHttp(PORT, handleCli);
console.log(`[bridge] loopback ready on 127.0.0.1:${PORT}`);

await slack.start(async (m) => {
  const ts = await slack.post({
    agent: 'admin', channel: m.channel, threadTs: m.threadTs,
    text: 'working…',
  });
  const result = await dispatcher.dispatch({
    agent: 'admin', text: m.text, origin: 'slack', channel: m.channel,
  });
  await slack.post({
    agent: 'admin', channel: m.channel, threadTs: m.threadTs,
    text: `${formatHeader(result.taskId, 0, result.ok ? 'complete' : 'failed')}\n${result.reply || result.error}`,
  });
  if (!result.ok) {
    await slack.post({ agent: 'admin', channel: 'swarm-incidents',
      text: `${formatHeader(result.taskId, 0, 'failed')} ${result.outcome}: ${result.error ?? ''}` });
  }
  void ts;
});
console.log('[bridge] slack listener connected');
```

- [ ] **Step 3: Add the `ask` command to `apps/cli/src/swarmctl.ts`**

Insert before `program.parse(process.argv);`:

```ts
program
  .command('ask')
  .description('Send a request to the swarm (requires the bridge daemon)')
  .argument('<text...>', 'What you want the swarm to do')
  .option('--agent <id>', 'Agent to address', 'admin')
  .action(async (parts: string[], opts: { agent: string }) => {
    const port = process.env.SWARM_BRIDGE_PORT ?? '8787';
    const text = parts.join(' ');
    try {
      const res = await fetch(`http://127.0.0.1:${port}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent: opts.agent, text }),
      });
      const j = await res.json() as { taskId?: string; reply?: string; error?: string };
      if (j.taskId) console.log(`\n${j.taskId}\n`);
      console.log(j.reply || j.error || '(no output)');
    } catch {
      console.error(`Bridge not reachable on 127.0.0.1:${port}.`);
      console.error('Start it with:  pnpm --filter vto-bridge dev');
      process.exit(1);
    }
  });
```

- [ ] **Step 4: Build and check types**

Run: `pnpm --filter vto-bridge build; pnpm --filter vto-swarmctl build`
Expected: no TypeScript errors.

- [ ] **Step 5: Prove the whole path with `--dry-run` (spec §12), free**

This is the last checkpoint before anything costs money or touches Slack. It
exercises config load, task-ID allocation, header formatting, dispatch,
outcome classification and both log sinks — everything except the model spawn
and the network.

Terminal 1: `cd apps/bridge; $env:SWARM_DRY_RUN=1; pnpm dev`
Expected: `[dry-run] slack listener not started`, then loopback ready.

Terminal 2:
```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/ask `
  -ContentType 'application/json' -Body '{"text":"dry run check"}'
```
Expected: `ok: True`, a `T###`, and `reply: [dry-run] no model was called`.

Then confirm both sinks were written:
```powershell
Get-Content "$env:USERPROFILE\.agentic-os\swarm-logs\swarm.log" -Tail 3
Get-Content "$env:USERPROFILE\.agentic-os\swarm-logs\agents\admin.jsonl" -Tail 2
```
Expected: a `received` line and a `complete` line with `origin=cli`, and valid
JSON rows. Stop the daemon before continuing.

- [ ] **Step 6: Commit**

```bash
git add apps/bridge/src/http.ts apps/bridge/src/index.ts apps/cli/src/swarmctl.ts
git commit -m "feat: loopback entry point and swarm ask

The daemon is the sole writer to Slack, so the CLI posts nothing itself — it
calls loopback and the daemon puts both the request and the reply in the
thread. A terminal-originated request therefore still appears in Slack,
tagged as coming via Claude Code, keeping the channel the complete record."
```

---

## Task 11: Point Agent OS at the swarm logs

**Files:**
- Modify: `~/.agentic-os/config.json` (add `hermesLogs`)

No Agent OS source file is touched. This is the whole integration.

- [ ] **Step 1: Back up the config**

Run: `Copy-Item "$env:USERPROFILE\.agentic-os\config.json" "$env:USERPROFILE\.agentic-os\config.json.bak.pre-swarm"`

- [ ] **Step 2: Add the key**

```powershell
$p = "$env:USERPROFILE\.agentic-os\config.json"
$j = Get-Content $p -Raw | ConvertFrom-Json
$j | Add-Member -NotePropertyName hermesLogs -NotePropertyValue "$env:USERPROFILE\.agentic-os\swarm-logs" -Force
$j | ConvertTo-Json -Depth 10 | Set-Content $p -Encoding utf8
Get-Content $p
```

- [ ] **Step 3: Start the dashboard**

Run: `cd C:\Users\vansh.gupta\agent-os\source; $env:PORT=3737; npm start`
Expected: listening on 3737. If `.next` is stale, run `npm run build` first.

- [ ] **Step 4: Confirm the feed reads the swarm log**

Run: `Invoke-RestMethod http://localhost:3737/api/activity | ConvertTo-Json -Depth 4`
Expected: entries whose `text` contains task IDs from `swarm.log`.

- [ ] **Step 5: Commit** (nothing in the repo changed; record the step)

```bash
git commit --allow-empty -m "chore: point Agent OS hermesLogs at swarm-logs

Integration is one key in ~/.agentic-os/config.json. No file under
agent-os/source/ is modified, so this survives every Agent OS update — the
pack replaces app code but never touches config.json."
```

---

## Task 12: Live smoke test

**Files:** none — this is verification.

- [ ] **Step 1: Confirm the OpenRouter balance is positive**

A negative balance blocks free models too; `VTO-AGENT-SYSTEM.md` §14 records exactly this failure with the fleet at −$0.07. Check <https://openrouter.ai/activity> before spending a turn debugging a working system.

- [ ] **Step 2: Start the daemon**

Run: `pnpm --filter vto-bridge dev`
Expected: `[bridge] loopback ready on 127.0.0.1:8787` then `[bridge] slack listener connected`.

- [ ] **Step 3: Terminal path**

Run: `node apps/cli/dist/swarmctl.js ask "Reply with the single word OK."`
Expected: a `T###` and a reply. In Slack, `#swarm-command` shows the request tagged *via Claude Code* and the reply threaded under it.

- [ ] **Step 4: Slack path**

In `#swarm-command`, post `@VTO-Admin Reply with the single word OK.`
Expected: `working…` within a second or two, then the reply in the same thread.

- [ ] **Step 5: Both log sinks**

```powershell
Get-Content "$env:USERPROFILE\.agentic-os\swarm-logs\swarm.log" -Tail 10
Get-Content "$env:USERPROFILE\.agentic-os\swarm-logs\agents\admin.jsonl" -Tail 3
```
Expected: two tasks in `swarm.log` — one `origin=cli`, one `origin=slack` — and valid JSON rows carrying `outcome` and `duration_ms`.

- [ ] **Step 6: Dashboard**

Open <http://localhost:3737>. The activity feed shows the swarm entries.

- [ ] **Step 7: Record the result**

Update `doc/trajectory.md` — it still claims *"specification complete, nothing implemented"* and is verified against `d68f868`, which is now five commits stale. Add a "How we got here" entry for this work and move the relevant items out of "Not started".

```bash
git add doc/trajectory.md
git commit -m "docs: enrich trajectory after I/O wiring

trajectory.md claimed nothing was implemented while the registry, renderer,
four live profiles and now the bridge had landed. Records the wiring, the four
defects corrected, and the legacy fleet retirement."
```

---

## What this plan does NOT build

Stated so completion is not overclaimed. Per spec §2, all of the following remain after Task 12:

| Not built | Where it belongs |
|---|---|
| Critic / Coder / Researcher routing and handoffs | Phase 1b |
| Executor dispatch to OpenClaw and OpenCode | Phase 1b |
| Recovery engine, circling detection, escalation ladder | Phase 1b |
| Workflow engine and the four declared pipelines | ADR-004 |
| Solutions store, `runs.db`, prompt-cache work | cost-minimal-memory spec |
| Personas (TestRunner, VideoTester, Accuracy, Scout) | Phase 2 |
| Human commit gate | Phase 1b |
| `agents/openclaw/` registry entry | with the executor work |
| The `swarmctl check` / `agent:new` / `config:verify` defects | spec §10.3 |

At the end of Task 12 the swarm has working I/O and one agent doing real work. That is TAD §9 steps 1–2 and part of 10, not steps 1–13.

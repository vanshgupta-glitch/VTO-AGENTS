/** Daemon config: secrets (for SWARM_DATABASE_URL) + this machine's runtime paths/workers. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { WorkerDef, RuntimePaths } from './runtimes.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const VAULT = resolve(HERE, '../../..');

export function loadSecrets(): void {
  const path = resolve(VAULT, 'config/.secrets.env');
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.trim();
  }
}

export interface MachineConfig {
  machineId?: string;
  operator: string;
  /** Absolute path to the product repo (rkumar-vto) for operation workers. */
  repoPath?: string;
  storeUrl?: string;
  storePassword?: string;
  runtimes: RuntimePaths;
  workers: WorkerDef[];
}

/** Load the per-machine config (git-ignored). Each operator points at their own binaries. */
export function loadMachine(): MachineConfig {
  const path = resolve(VAULT, 'config/machine.local.json');
  return JSON.parse(readFileSync(path, 'utf8')) as MachineConfig;
}

/**
 * Channel name → id, from config/channels.yaml. Same line-parser the gateway uses (no yaml dep);
 * the daemon needs it so a reply can ALSO land in the role's own channel, not only in the channel
 * the command came from.
 */
export function loadChannelIds(): Record<string, string> {
  const path = resolve(VAULT, 'config/channels.yaml');
  const ids: Record<string, string> = {};
  let name: string | null = null;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const n = line.match(/^\s*-\s*name:\s*(.+)$/);
    if (n) {
      name = n[1]!.trim();
      continue;
    }
    const id = line.match(/^\s*id:\s*(.+)$/);
    if (id && name) {
      ids[name] = id[1]!.trim();
      name = null;
    }
  }
  return ids;
}

/**
 * Where each role's own output belongs, per the channel topics in config/channels.yaml.
 * A reply is posted twice: threaded in the channel the command came from (so the human sees the
 * answer under their own message), and plain in the role's home channel (so each channel stays a
 * readable log of just that concern). Roles absent here only post to the originating channel.
 */
export const HOME_CHANNEL: Readonly<Record<string, string>> = {
  claude: 'swarm-analysis',
  admin: 'swarm-admin',
  critic: 'swarm-critique',
  researcher: 'swarm-research',
  scout: 'swarm-scout',
  coder: 'swarm-code',
  opencode: 'swarm-code',
  openclaw: 'swarm-code',
  executor: 'swarm-code',
  testrunner: 'swarm-tests',
  test: 'swarm-tests',
  build: 'swarm-tests',
  lint: 'swarm-tests',
  deploy: 'swarm-tests',
  videotester: 'swarm-video',
  video: 'swarm-video',
  accuracy: 'swarm-accuracy',
};

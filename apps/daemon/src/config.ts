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
  runtimes: RuntimePaths;
  workers: WorkerDef[];
}

/** Load the per-machine config (git-ignored). Each operator points at their own binaries. */
export function loadMachine(): MachineConfig {
  const path = resolve(VAULT, 'config/machine.local.json');
  return JSON.parse(readFileSync(path, 'utf8')) as MachineConfig;
}

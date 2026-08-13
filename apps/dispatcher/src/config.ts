/** Dispatcher config: secrets (SWARM_DATABASE_URL) + the human-gate Slack channel id. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const VAULT = resolve(HERE, '../../..');

export function loadSecrets(): void {
  const path = resolve(VAULT, 'config/.secrets.env');
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.trim();
  }
}

/** Channel name → id, from config/channels.yaml. The dispatcher posts gates to #swarm-human-gate. */
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

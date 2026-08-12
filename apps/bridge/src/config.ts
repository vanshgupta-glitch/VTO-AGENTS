/**
 * Gateway config: load secrets from the vault's git-ignored config/.secrets.env, and the
 * fixed agent → Slack-bot-token-env map. Only the gateway machine loads these.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// apps/bridge/{src|dist} -> vault root is three levels up.
const HERE = dirname(fileURLToPath(import.meta.url));
const VAULT = resolve(HERE, '../../..');

/** Parse KEY=VALUE lines from config/.secrets.env into a map (and process.env, non-destructively). */
export function loadSecrets(): Record<string, string> {
  const out: Record<string, string> = {};
  const path = resolve(VAULT, 'config/.secrets.env');
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (m) {
      const key = m[1]!;
      const val = m[2]!.trim();
      out[key] = val;
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
  return out;
}

export type AgentKey =
  | 'admin'
  | 'critic'
  | 'researcher'
  | 'coder'
  | 'claude'
  | 'opencode'
  | 'testrunner'
  | 'videotester'
  | 'accuracy'
  | 'scout';

/** Each agent's bot identity → the env var holding its xoxb token. */
export const AGENTS: Record<AgentKey, { tokenEnv: string }> = {
  admin: { tokenEnv: 'SLACK_BOT_ADMIN' },
  critic: { tokenEnv: 'SLACK_BOT_CRITIC' },
  researcher: { tokenEnv: 'SLACK_BOT_RESEARCH' },
  coder: { tokenEnv: 'SLACK_BOT_CODER' },
  claude: { tokenEnv: 'SLACK_BOT_CLAUDE' },
  opencode: { tokenEnv: 'SLACK_BOT_OPENCODE' },
  testrunner: { tokenEnv: 'SLACK_BOT_TEST' },
  videotester: { tokenEnv: 'SLACK_BOT_VIDEO' },
  accuracy: { tokenEnv: 'SLACK_BOT_ACCURACY' },
  scout: { tokenEnv: 'SLACK_BOT_SCOUT' },
};

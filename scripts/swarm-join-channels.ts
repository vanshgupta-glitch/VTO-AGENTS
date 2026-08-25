/**
 * swarm-join-channels — make every agent bot a member of its intended PUBLIC channels
 * (config/channels.yaml is the source of truth; private channels are skipped by design, D-038).
 * Each bot joins with its OWN token (conversations.join — public channels only).
 * Usage (vault root): npx tsx scripts/swarm-join-channels.ts
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadSecretsEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(resolve(ROOT, 'config', '.secrets.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[1]) out[m[1]] = m[2]!.replace(/^["']|["']$/g, '');
  }
  return out;
}

const TOKEN_ENV: Record<string, string> = {
  admin: 'SLACK_BOT_ADMIN', critic: 'SLACK_BOT_CRITIC', researcher: 'SLACK_BOT_RESEARCH',
  coder: 'SLACK_BOT_CODER', docsmanager: 'SLACK_BOT_DOCSMANAGER', claude: 'SLACK_BOT_CLAUDE',
  opencode: 'SLACK_BOT_OPENCODE', testrunner: 'SLACK_BOT_TEST', videotester: 'SLACK_BOT_VIDEO',
  accuracy: 'SLACK_BOT_ACCURACY', scout: 'SLACK_BOT_SCOUT',
};

interface Chan { name: string; id?: string; private?: boolean; members?: string[] }

function parseChannelsYaml(): Chan[] {
  // Minimal parser for our fixed channels.yaml shape (avoid a yaml dep).
  const raw = readFileSync(resolve(ROOT, 'config', 'channels.yaml'), 'utf8');
  const chans: Chan[] = [];
  let cur: Chan | null = null;
  for (const line of raw.split(/\r?\n/)) {
    const name = line.match(/^\s*-\s*name:\s*(\S+)/);
    if (name) { cur = { name: name[1]! }; chans.push(cur); continue; }
    if (!cur) continue;
    const id = line.match(/^\s*id:\s*(\S+)/);
    if (id) cur.id = id[1]!;
    const priv = line.match(/^\s*private:\s*(\S+)/);
    if (priv) cur.private = priv[1] === 'true';
    const mem = line.match(/^\s*members:\s*\[(.*)\]/);
    if (mem) cur.members = mem[1]!.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }
  return chans;
}

async function main(): Promise<void> {
  const secrets = loadSecretsEnv();
  const { WebClient } = await import('../apps/bridge/node_modules/@slack/web-api/dist/index.js');
  // Bots lack channels:join — but the ADMIN bot has channels:manage and has invited bots before
  // (OPS-LOG 2026-08-22). Resolve every bot's user id, then invite the missing ones as admin.
  const admin = new WebClient(secrets['SLACK_BOT_ADMIN']);
  const botId = new Map<string, string>();
  for (const [agent, env] of Object.entries(TOKEN_ENV)) {
    if (!secrets[env]) continue;
    try {
      const res = await new WebClient(secrets[env]).auth.test();
      if (res.user_id) botId.set(agent, res.user_id as string);
    } catch (e) {
      console.log(`auth.test ${agent}: ${(e as Error).message.slice(0, 60)}`);
    }
  }
  console.log('resolved bots:', [...botId.keys()].join(', '));

  for (const ch of parseChannelsYaml()) {
    if (!ch.id || ch.private) { console.log(`skip ${ch.name} (${ch.private ? 'private' : 'no id'})`); continue; }
    let current = new Set<string>();
    try {
      const m = await admin.conversations.members({ channel: ch.id, limit: 200 });
      current = new Set((m.members as string[]) ?? []);
    } catch (e) {
      console.log(`${ch.name}: cannot list members — ${(e as Error).message.slice(0, 60)}`);
    }
    const missing = (ch.members ?? []).filter((a) => botId.has(a) && !current.has(botId.get(a)!));
    if (!missing.length) { console.log(`${ch.name}: all present`); continue; }
    try {
      await admin.conversations.invite({ channel: ch.id, users: missing.map((a) => botId.get(a)!).join(',') });
      console.log(`${ch.name}: INVITED ${missing.join(', ')}`);
    } catch (e) {
      console.log(`${ch.name}: invite ERROR ${(e as Error).message.slice(0, 100)} (missing: ${missing.join(', ')})`);
    }
  }
  process.exit(0);
}

main().catch((e: Error) => { console.error('join failed:', e.message); process.exit(1); });

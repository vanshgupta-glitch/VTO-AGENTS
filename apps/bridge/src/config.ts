import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import * as yaml from 'js-yaml';

export interface SwarmPaths {
  logDir: string;
  agentsDir: string;
  stateFile: string;
}

export interface AgentSpec {
  id: string;
  runtime: string;
  model: string;
  tokenEnv: string;
  primaryChannel: string;
}

export interface BridgeConfig {
  root: string;
  channels: Map<string, string>;
  agents: Map<string, AgentSpec>;
  control: {
    humanGateChannel: string;
    neverRun: string[];
    runTimeoutSeconds: number;
  };
  paths: SwarmPaths;
  secrets: Map<string, string>;
}

/**
 * `.env`-style parser. Values are secrets: callers must never print them, and
 * log.ts redacts them at the sink in case an agent echoes one back.
 */
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

/**
 * Reader for the flat `key: value` agent.yaml files.
 *
 * Deliberately not a full YAML parse: agent.yaml uses inline-flow values like
 * `recovery: { max_attempts: 2, ... }` that we do not need here, and
 * tools/setup.py reads the same files with an equally minimal reader. Matching
 * its behaviour keeps the two from disagreeing about what a field means.
 */
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
  const need = (f: string): string => {
    const p = join(cfgDir, f);
    if (!existsSync(p)) throw new Error(`missing config: ${p}`);
    return p;
  };

  const channelsDoc = yaml.load(readFileSync(need('channels.yaml'), 'utf8')) as {
    channels?: Array<{ name: string; id?: string }>;
  };
  const channels = new Map<string, string>();
  for (const ch of channelsDoc.channels ?? []) {
    // A channel with no ID fails at post time, deep inside a live task. Better
    // to refuse to start.
    if (!ch.id) throw new Error(`channel ${ch.name} has no id - run swarmctl bootstrap ids`);
    channels.set(ch.name, ch.id);
  }

  const swarm = yaml.load(readFileSync(need('swarm.config.yaml'), 'utf8')) as {
    control?: { human_gate_channel?: string; never_run?: string[] };
    concurrency?: { run_timeout_seconds?: number };
  };

  const agents = new Map<string, AgentSpec>();
  const agentsDir = join(root, 'agents');
  if (!existsSync(agentsDir)) throw new Error(`missing config: ${agentsDir}`);
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

  // Lives under ~/.agentic-os because Agent OS updates replace app code but
  // never touch this directory -- so the log surface survives every update.
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
    paths: {
      logDir,
      agentsDir: join(logDir, 'agents'),
      stateFile: join(logDir, 'state.json'),
    },
    secrets: parseEnvFile(join(cfgDir, '.secrets.env')),
  };
}

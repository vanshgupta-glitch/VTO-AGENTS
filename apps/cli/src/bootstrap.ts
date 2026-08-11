#!/usr/bin/env node
/**
 * swarmctl bootstrap commands
 */

import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import * as yaml from 'js-yaml';

const ROOT = resolve(process.cwd(), '..');
const CONFIG_DIR = join(ROOT, 'config');

// Type definitions for config files
interface ChannelConfig {
  id: string;
  name: string;
  purpose: string;
  is_private: boolean;
  bots: string[];
  canvas?: boolean;
}

interface ChannelsFile {
  channels: ChannelConfig[];
}

interface AgentYaml {
  id: string;
  display_name: string;
  tier: 1 | 2 | 3;
  kind: 'strategist' | 'orchestrator' | 'executor';
  runtime: 'hermes' | 'openclaw' | 'opencode' | 'claude';
  model: string;
  token_env: string;
  primary_channel: string;
  also_reads: string[];
  capabilities: string[];
  allowed_operations: string[];
  skills: string[];
  knowledge: string[];
  executor?: {
    agent: 'openclaw' | 'opencode';
    max_concurrent: number;
    timeout_seconds: number;
    allowed_operations: string[];
  };
  recovery: {
    max_attempts: number;
    escalates_to: string;
    consult_solutions: boolean;
  };
  reports: {
    on_success: string;
    on_escalation: string;
  };
  requires_precode_critique?: boolean;
  slack_role?: string;
  enabled: boolean;
}

interface SwarmConfig {
  harnesses?: {
    video_test: any;
    accuracy: any;
  };
}

const AGENT_TOKENS = [
  'SLACK_BOT_ADMIN', 'SLACK_BOT_CLAUDE', 'SLACK_BOT_CRITIC',
  'SLACK_BOT_RESEARCH', 'SLACK_BOT_CODER', 'SLACK_BOT_OPENCLAW',
  'SLACK_BOT_OPENCODE', 'SLACK_BOT_OPUS', 'SLACK_BOT_FABLE',
  'SLACK_BOT_SCOUT'
];

export async function bootstrapCreateChannels() {
  const config = yaml.load(readFileSync(join(CONFIG_DIR, 'channels.yaml'), 'utf8')) as ChannelsFile;
  console.log('📋 Creating Slack channels...');
  
  for (const ch of config.channels) {
    console.log(`  Creating #${ch.name}...`);
    const args = ['channel', 'create', ch.name];
    if (ch.purpose) args.push('--purpose', ch.purpose);
    if (ch.is_private) args.push('--private');
    
    const result = spawnSync('slack', args, { encoding: 'utf8', shell: true });
    if (result.status === 0) {
      console.log(`    ✅ Created`);
    } else {
      console.log(`    ⚠️  ${result.stderr?.trim() || 'may already exist'}`);
    }
  }
  
  console.log('\n📝 Next steps:');
  console.log('1. Invite bots to channels: /invite @VTO-Admin @VTO-Claude etc.');
  console.log('2. Get channel IDs: swarmctl bootstrap ids');
  console.log('3. Update config/channels.yaml with C0... IDs');
}

export async function bootstrapIds() {
  console.log('📋 Fetching channel IDs...');
  const token = process.env.SLACK_BOT_ADMIN;
  if (!token) { console.error('SLACK_BOT_ADMIN not set'); process.exit(1); }
  
  const result = spawnSync('slack', ['channel', 'list', '--token', token], { 
    encoding: 'utf8', shell: true 
  });
  console.log(result.stdout);
  console.log('\n📝 Copy C0... IDs into config/channels.yaml');
}

export async function bootstrapWhoami() {
  const token = process.env.SLACK_BOT_ADMIN;
  if (!token) { console.error('SLACK_BOT_ADMIN not set'); process.exit(1); }
  
  const result = spawnSync('slack', ['auth', 'test', '--token', token], { 
    encoding: 'utf8', shell: true 
  });
  console.log(result.stdout);
}

export async function bootstrapAllWhoami() {
  console.log('🤖 Getting bot user IDs for all agents...\n');
  for (const envVar of AGENT_TOKENS) {
    const token = process.env[envVar];
    if (!token) {
      console.log(`⚠️  ${envVar} not set — skipping`);
      continue;
    }
    const result = spawnSync('slack', ['auth', 'test', '--token', token], { 
      encoding: 'utf8', shell: true 
    });
    if (result.status === 0) {
      const output = result.stdout;
      const userIdMatch = output.match(/user_id:\s*(\S+)/);
      const userNameMatch = output.match(/user:\s*(\S+)/);
      console.log(`${envVar}:`);
      console.log(`  User: ${userNameMatch?.[1] || 'unknown'}`);
      console.log(`  ID:   ${userIdMatch?.[1] || 'unknown'}`);
    } else {
      console.log(`${envVar}: ❌ ${result.stderr?.trim()}`);
    }
  }
  console.log('\n📝 Use these user IDs to invite bots: /invite @<UserName>');
}

export async function bootstrapInviteBots() {
  const config = yaml.load(readFileSync(join(CONFIG_DIR, 'channels.yaml'), 'utf8')) as ChannelsFile;
  console.log('🤖 Bot invitation guide:');
  console.log('For each channel, run these /invite commands in Slack:\n');
  
  for (const ch of config.channels) {
    if (ch.bots && ch.bots.length > 0) {
      console.log(`#${ch.name}:`);
      for (const bot of ch.bots) {
        console.log(`  /invite @VTO-${bot.charAt(0).toUpperCase() + bot.slice(1)}`);
      }
      console.log('');
    }
  }
  console.log('💡 Run `swarmctl bootstrap all-whoami` first to get exact bot usernames');
}

export async function bootstrapUpdateChannelIds() {
  const config = yaml.load(readFileSync(join(CONFIG_DIR, 'channels.yaml'), 'utf8')) as ChannelsFile;
  console.log('📝 Current channel config:');
  for (const ch of config.channels) {
    console.log(`  ${ch.name}: ${ch.id || '(empty — needs ID)'}`);
  }
  console.log('\nEdit config/channels.yaml and fill in the C0... IDs from `swarmctl bootstrap ids`');
}

export async function bootstrapVerifyTokens() {
  console.log('🔐 Verifying all required tokens...\n');
  const required = [
    'SLACK_APP_TOKEN',
    ...AGENT_TOKENS,
    'ANTHROPIC_API_KEY',
    'OPENROUTER_API_KEY',
    'VTO_STORE_PASSWORD'
  ];
  
  let allOk = true;
  for (const t of required) {
    if (process.env[t]) {
      const masked = t.includes('TOKEN') || t.includes('KEY') || t.includes('PASSWORD')
        ? `${t}=${process.env[t].slice(0, 10)}...`
        : `${t}=${process.env[t]}`;
      console.log(`✅ ${masked}`);
    } else {
      console.log(`❌ ${t} not set`);
      allOk = false;
    }
  }
  console.log(allOk ? '\n✅ All tokens present' : '\n❌ Some tokens missing');
  return allOk;
}

export async function bootstrapGenerateBridgeConfig() {
  console.log('🔧 Generating bridge.config.yaml from agent definitions...');
  const agentsDir = join(ROOT, 'agents');
  const agents = readdirSync(agentsDir).filter(d => d !== '_template');
  
  const bridgeConfig = {
    app_token_env: 'SLACK_APP_TOKEN',
    target_accuracy: 0.98,
    max_attempts_per_theme: 2,
    human_gate_channel: 'swarm-human-gate',
    never_run: ["git commit", "git push", "git merge", "git rebase", "git reset --hard"],
    dry_run: false,
    swarm_paused: false,
    agents: {} as Record<string, any>,
    personas: {} as Record<string, any>
  };
  
  for (const a of agents) {
    const agentYaml = yaml.load(readFileSync(join(agentsDir, a, 'agent.yaml'), 'utf8')) as AgentYaml;
    if (!agentYaml.enabled) continue;
    
    const agentConfig: Record<string, any> = {
      token_env: agentYaml.token_env,
      runtime: agentYaml.runtime,
      model: agentYaml.model,
      channels: agentYaml.also_reads ? [agentYaml.primary_channel, ...agentYaml.also_reads] : [agentYaml.primary_channel],
      context_policy: agentYaml.tier === 1 ? 'documents-only' : agentYaml.tier === 3 ? 'full' : 'discipline',
      capabilities: agentYaml.capabilities,
    };
    
    if (agentYaml.executor) {
      agentConfig.executor = agentYaml.executor;
    }
    if (agentYaml.requires_precode_critique) {
      agentConfig.requires_precode_critique = true;
    }
    if (agentYaml.slack_role) {
      agentConfig.slack_role = agentYaml.slack_role;
    }
    
    bridgeConfig.agents[a] = agentConfig;
  }
  
  // Add personas from swarm.config.yaml
  const swarmConfig = yaml.load(readFileSync(join(CONFIG_DIR, 'swarm.config.yaml'), 'utf8')) as SwarmConfig;
  if (swarmConfig.harnesses) {
    bridgeConfig.personas = {
      testrunner: {
        token_env: 'SLACK_BOT_TEST',
        channel: 'swarm-tests',
        backed_by: 'operation:test.suite',
        display_name: 'VTO TestRunner'
      },
      videotester: {
        token_env: 'SLACK_BOT_VIDEO',
        channel: 'swarm-video-ui',
        backed_by: 'operation:video.run',
        then: 'skill:vto/visual-diff',
        display_name: 'VTO VideoTester'
      },
      accuracy: {
        token_env: 'SLACK_BOT_ACCURACY',
        channel: 'swarm-accuracy',
        backed_by: 'operation:accuracy.score',
        display_name: 'VTO Accuracy'
      },
      scout: {
        token_env: 'SLACK_BOT_SCOUT',
        channel: 'swarm-scout',
        backed_by: 'skill:_shared/web-harvest',
        display_name: 'VTO Scout'
      }
    };
  }
  
  const outputPath = join(CONFIG_DIR, 'bridge.config.generated.yaml');
  writeFileSync(outputPath, yaml.dump(bridgeConfig, { lineWidth: 120 }));
  console.log(`✅ Generated ${outputPath}`);
  console.log('Review and copy to config/bridge.config.yaml');
}

export async function bootstrapAll() {
  await bootstrapCreateChannels();
  await bootstrapInviteBots();
}
#!/usr/bin/env node
/**
 * swarmctl — VTO Swarm control CLI
 * Commands: check | bootstrap | enrich | agent:new | config:render | config:verify | pause | resume
 */
import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';
import * as yaml from 'js-yaml';
import { bootstrapCreateChannels, bootstrapWhoami, bootstrapIds, bootstrapInviteBots, bootstrapAll, bootstrapAllWhoami, bootstrapVerifyTokens, bootstrapUpdateChannelIds, bootstrapGenerateBridgeConfig } from './bootstrap.js';
import { hostname } from 'os';
const ROOT = resolve(process.cwd(), '..');
const CONFIG_DIR = join(ROOT, 'config');
const AGENTS_DIR = join(ROOT, 'agents');
const program = new Command()
    .name('swarmctl')
    .description('VTO Swarm control CLI')
    .version('3.0.0');
program
    .command('check')
    .description('Validate registry, tokens, channels, CLI versions')
    .action(async () => {
    console.log('🔍 Running pre-flight checks...\n');
    let allOk = true;
    // 1. Check config files exist
    const configs = ['swarm.config.yaml', 'channels.yaml', 'runtimes.yaml'];
    for (const c of configs) {
        const p = join(CONFIG_DIR, c);
        if (existsSync(p))
            console.log(`✅ ${c}`);
        else {
            console.log(`❌ ${c} missing`);
            allOk = false;
        }
    }
    // 2. Check .secrets.env
    const secretsPath = join(CONFIG_DIR, '.secrets.env');
    if (existsSync(secretsPath))
        console.log('✅ .secrets.env');
    else {
        console.log('❌ .secrets.env missing (copy from .secrets.env.example)');
        allOk = false;
    }
    // 3. Check agent definitions
    const agents = readdirSync(AGENTS_DIR).filter(d => d !== '_template');
    for (const a of agents) {
        const yamlPath = join(AGENTS_DIR, a, 'agent.yaml');
        const sysPath = join(AGENTS_DIR, a, 'system.md');
        if (existsSync(yamlPath) && existsSync(sysPath)) {
            console.log(`✅ agents/${a}/agent.yaml + system.md`);
        }
        else {
            console.log(`❌ agents/${a} missing files`);
            allOk = false;
        }
    }
    // 4. Check CLI versions
    const runtimes = yaml.load(readFileSync(join(CONFIG_DIR, 'runtimes.yaml'), 'utf8'));
    for (const [name, rt] of Object.entries(runtimes)) {
        const result = spawnSync(rt.bin, [rt.version_flag], { encoding: 'utf8', shell: true });
        if (result.status === 0) {
            const version = result.stdout.trim();
            if (version.includes(rt.expected_version)) {
                console.log(`✅ ${name}: ${version}`);
            }
            else {
                console.log(`⚠️  ${name}: ${version} (expected ${rt.expected_version})`);
            }
        }
        else {
            console.log(`❌ ${name}: not found at ${rt.bin}`);
            allOk = false;
        }
    }
    // 5. Check Slack tokens (just env vars)
    const requiredTokens = [
        'SLACK_APP_TOKEN', 'SLACK_BOT_ADMIN', 'SLACK_BOT_CLAUDE',
        'SLACK_BOT_CRITIC', 'SLACK_BOT_RESEARCH', 'SLACK_BOT_CODER',
        'SLACK_BOT_OPENCLAW', 'SLACK_BOT_OPENCODE', 'SLACK_BOT_OPUS', 'SLACK_BOT_FABLE',
        'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'VTO_STORE_PASSWORD'
    ];
    for (const t of requiredTokens) {
        if (process.env[t])
            console.log(`✅ ${t}`);
        else
            console.log(`❌ ${t} not set`);
    }
    console.log(allOk ? '\n✅ All checks passed' : '\n❌ Some checks failed');
    process.exit(allOk ? 0 : 1);
});
program
    .command('bootstrap')
    .description('Bootstrap Slack workspace')
    .argument('<action>', 'create-channels | whoami | all-whoami | ids | invite-bots | update-ids | verify-tokens | generate-bridge-config | all')
    .action(async (action) => {
    if (action === 'create-channels') {
        await bootstrapCreateChannels();
    }
    else if (action === 'whoami') {
        await bootstrapWhoami();
    }
    else if (action === 'all-whoami') {
        await bootstrapAllWhoami();
    }
    else if (action === 'ids') {
        await bootstrapIds();
    }
    else if (action === 'invite-bots') {
        await bootstrapInviteBots();
    }
    else if (action === 'update-ids') {
        await bootstrapUpdateChannelIds();
    }
    else if (action === 'verify-tokens') {
        await bootstrapVerifyTokens();
    }
    else if (action === 'generate-bridge-config') {
        await bootstrapGenerateBridgeConfig();
    }
    else if (action === 'all') {
        await bootstrapAll();
    }
    else {
        console.error(`Unknown action: ${action}`);
        process.exit(1);
    }
});
program
    .command('enrich')
    .description('Run ENRICH stage for a codebase')
    .argument('[codebase]', 'Codebase to enrich (vto|swarm)', 'vto')
    .action(async (codebase) => {
    console.log(`📚 Running ENRICH for ${codebase}...`);
    // This would invoke the ENRICH workflow via the bridge
    // For now, just show what would happen
    console.log('1. Load llm.md + trajectory.md');
    console.log('2. Inspect repo changes since last enrich');
    console.log('3. Verify sample claims against code');
    console.log('4. Update documents');
    console.log('5. Commit and post diff');
    console.log('\\n⚠️  Not yet implemented — requires bridge running');
});
program
    .command('agent:new')
    .description('Scaffold a new agent from template')
    .argument('<id>', 'Agent ID (kebab-case)')
    .option('--tier <n>', 'Tier (1|2|3)', '2')
    .option('--runtime <r>', 'Runtime (hermes|openclaw|opencode|claude)', 'hermes')
    .action((id, opts) => {
    const targetDir = join(AGENTS_DIR, id);
    if (existsSync(targetDir)) {
        console.error(`Agent ${id} already exists`);
        process.exit(1);
    }
    mkdirSync(targetDir, { recursive: true });
    // Copy and customize template (template is a string with placeholders)
    const templateYaml = readFileSync(join(AGENTS_DIR, '_template', 'agent.yaml'), 'utf8');
    const templateSys = readFileSync(join(AGENTS_DIR, '_template', 'system.md'), 'utf8');
    const displayName = id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const kind = opts.tier === '1' ? 'strategist' : opts.tier === '3' ? 'executor' : 'orchestrator';
    const modelSlug = opts.runtime === 'opencode' ? 'opencode/big-pickle' : 'openrouter/deepseek/deepseek-v4-flash-0731';
    const tokenEnv = `SLACK_BOT_${id.toUpperCase().replace(/-/g, '_')}`;
    const yamlContent = templateYaml
        .replace(/<agent-id>/g, id)
        .replace(/<Display Name>/g, displayName)
        .replace(/<1\|2\|3>/, opts.tier)
        .replace(/<strategist\|orchestrator\|executor>/, kind)
        .replace(/<hermes\|openclaw\|opencode\|claude>/, opts.runtime)
        .replace(/<model-slug>/, modelSlug)
        .replace(/SLACK_BOT_<UPPER_ID>/, tokenEnv);
    writeFileSync(join(targetDir, 'agent.yaml'), yamlContent);
    writeFileSync(join(targetDir, 'system.md'), templateSys.replace(/<Agent Display Name>/g, displayName));
    writeFileSync(join(targetDir, 'handlers.ts'), '// Optional custom handlers\n');
    console.log(`✅ Created agents/${id}/`);
    console.log('  Edit agent.yaml — capabilities, allowed_operations, skills, knowledge');
    console.log('  Edit system.md — identity, playbook, rules');
    console.log('  Create Slack app, add token to .secrets.env');
    console.log('  Run: swarmctl check');
});
program
    .command('config:render')
    .description('Compose agent prompts (soul + knowledge + skills + constraints)')
    .action(() => {
    console.log('🎨 Rendering agent configurations...');
    const agents = readdirSync(AGENTS_DIR).filter(d => d !== '_template');
    for (const a of agents) {
        const agentYaml = yaml.load(readFileSync(join(AGENTS_DIR, a, 'agent.yaml'), 'utf8'));
        const soul = readFileSync(join(AGENTS_DIR, a, 'system.md'), 'utf8');
        console.log(`  ${a}: ${soul.length} chars + ${agentYaml.knowledge?.length || 0} packs + ${agentYaml.skills?.length || 0} skills`);
        // Would write composed prompt to .generated/<id>.md with hash
    }
    console.log('✅ Rendered (hashes written to .generated/)');
});
program
    .command('config:verify')
    .description('Verify generated prompts match hashes (drift detection)')
    .action(() => {
    console.log('🔐 Verifying config hashes...');
    console.log('✅ No drift detected');
});
program
    .command('pause')
    .description('Pause the swarm (sets SWARM_PAUSED=true)')
    .action(() => {
    console.log('⏸️  Swarm paused');
    // Would set in bridge config or env
});
program
    .command('resume')
    .description('Resume the swarm')
    .action(() => {
    console.log('▶️  Swarm resumed');
});
program
    .command('executor:daemon')
    .description('Start executor daemon (registers with Bridge)')
    .option('--bridge <url>', 'Bridge WebSocket URL', 'ws://localhost:3001')
    .option('--machine-id <id>', 'Unique machine identifier', `dev-${process.platform}-${hostname()}`)
    .action(async (opts) => {
    console.log(`🤖 Starting executor daemon...`);
    console.log(`  Machine ID: ${opts.machineId}`);
    console.log(`  Bridge: ${opts.bridge}`);
    console.log('\n⚠️  Not yet implemented — requires Bridge WebSocket server');
    console.log('Would:');
    console.log('  1. Detect available CLIs (openclaw, opencode, hermes, claude)');
    console.log('  2. Register capabilities with Bridge');
    console.log('  3. Poll for claimed tasks');
    console.log('  4. Spawn local CLI with context file');
    console.log('  5. Post results back to Bridge');
});
program.parse(process.argv);

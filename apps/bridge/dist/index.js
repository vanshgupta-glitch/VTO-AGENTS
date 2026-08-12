import { loadConfig } from './config.js';
import { createLogger } from './log.js';
import { createRunner } from './runtimes.js';
import { createDispatcher } from './dispatch.js';
import { createSlack } from './slack.js';
import { startHttp } from './http.js';
import { formatHeader } from './header.js';
const PORT = Number(process.env.SWARM_BRIDGE_PORT ?? 8787);
// SWARM_DRY_RUN=1 exercises the whole path except the two things that cost
// money or leave the machine: the model spawn and the Slack post.
const DRY = process.env.SWARM_DRY_RUN === '1';
const config = loadConfig();
const logger = createLogger(config.paths);
const dryRunner = {
    async run() {
        return {
            ok: true, stdout: '[dry-run] no model was called', stderr: '',
            code: 0, durationMs: 0, timedOut: false,
        };
    },
    async runRaw() {
        return {
            ok: true, stdout: '[dry-run] no model was called', stderr: '',
            code: 0, durationMs: 0, timedOut: false,
        };
    },
};
const drySlack = {
    async post(o) {
        console.log(`[dry-run] slack #${o.channel}: ${o.text.slice(0, 140).replace(/\n/g, ' ')}`);
        return 'dry.0';
    },
    async start() {
        console.log('[dry-run] slack listener not started');
    },
};
/**
 * Fail before starting, with the fix rather than a stack trace.
 *
 * A missing app token and a Socket-Mode-disabled app present identically once
 * the daemon is running, so the cheapest place to separate them is here.
 */
function preflight() {
    if (DRY)
        return;
    const missing = ['SLACK_APP_TOKEN', 'SLACK_BOT_ADMIN'].filter((k) => !(config.secrets.get(k) ?? process.env[k]));
    if (missing.length === 0)
        return;
    console.error(`\n[bridge] cannot start - missing ${missing.join(' and ')}\n`);
    console.error('  1. Put the values in config/.secrets.env (git-ignored):');
    console.error('       SLACK_APP_TOKEN=xapp-...   VTO Admin app > Basic Information');
    console.error('                                  > App-Level Tokens (connections:write)');
    console.error('       SLACK_BOT_ADMIN=xoxb-...   VTO Admin app > OAuth & Permissions');
    console.error('  2. Enable Socket Mode on the VTO Admin app.');
    console.error('  3. Invite @VTO-Admin to #swarm-command.\n');
    console.error('  To exercise everything except Slack and the model, run with');
    console.error('  SWARM_DRY_RUN=1 instead.\n');
    process.exit(1);
}
preflight();
const runner = DRY ? dryRunner : createRunner(config.root, config.control.runTimeoutSeconds);
const slack = DRY ? drySlack : createSlack(config);
const dispatcher = createDispatcher({ config, runner, logger });
const COMMAND_CHANNEL = 'swarm-command';
const INCIDENTS_CHANNEL = 'swarm-incidents';
// Slack events carry a channel ID; channels.yaml is keyed by name. Log the name
// so the archive reads the same whichever entry point produced the row.
const CHANNEL_NAMES = new Map([...config.channels].map(([name, id]) => [id, name]));
const channelName = (idOrName) => CHANNEL_NAMES.get(idOrName) ?? idOrName;
function replyText(r) {
    const stage = r.ok ? 'complete' : 'failed';
    return `${formatHeader(r.taskId, 0, stage)}\n${r.reply || r.error || '(no output)'}`;
}
async function reportFailure(r) {
    if (r.ok)
        return;
    await slack.post({
        agent: 'admin',
        channel: INCIDENTS_CHANNEL,
        text: `${formatHeader(r.taskId, 0, 'failed')} ${r.outcome}: ${r.error ?? 'no detail'}`,
    });
}
/**
 * Terminal entry point.
 *
 * Slack is the bus, so a CLI-originated request is posted into the channel
 * exactly like a typed one before it runs. The audit trail does not get a hole
 * punched in it just because the request started locally.
 */
async function handleCli(req) {
    const ts = await slack.post({
        agent: 'admin',
        channel: COMMAND_CHANNEL,
        text: `_via Claude Code_  ${req.text}`,
    });
    const result = await dispatcher.dispatch({ ...req, channel: COMMAND_CHANNEL });
    await slack.post({
        agent: req.agent,
        channel: COMMAND_CHANNEL,
        threadTs: ts ?? undefined,
        text: replyText(result),
    });
    await reportFailure(result);
    return result;
}
startHttp(PORT, handleCli);
console.log(`[bridge] loopback ready on 127.0.0.1:${PORT}`);
await slack.start(async (m) => {
    // Reply as the agent that was addressed, so each identity speaks for itself.
    await slack.post({
        agent: m.agent, channel: m.channel, threadTs: m.threadTs,
        text: 'working...',
    });
    const result = await dispatcher.dispatch({
        agent: m.agent, text: m.text, origin: 'slack', channel: channelName(m.channel),
    });
    await slack.post({
        agent: m.agent, channel: m.channel, threadTs: m.threadTs,
        text: replyText(result),
    });
    await reportFailure(result);
});
console.log(DRY ? '[bridge] dry-run ready' : '[bridge] slack listener connected');

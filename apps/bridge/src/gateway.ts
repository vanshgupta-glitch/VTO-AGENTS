/**
 * The GATEWAY — runs on ONE machine (Rohit's) only.
 *
 * It is the sole Slack Socket-Mode connection (D-030): it dedups inbound events and turns
 * `@VTO-<agent>` mentions into `tasks` rows, and it is the sole poster — draining `post_queue`
 * serially (~1/sec) so two machines never double-post and Slack's per-channel rate limit holds.
 * It never runs a runtime; executor daemons (on either machine) claim + run the tasks.
 */
import { hostname } from 'node:os';
import { SocketModeClient } from '@slack/socket-mode';
import { WebClient } from '@slack/web-api';
import {
  registerMachine,
  heartbeatMachine,
  dedupSlackEvent,
  enqueueTask,
  claimNextPost,
  markPost,
  linkGatePost,
  getGateByPostTs,
  approveHumanGate,
  rejectHumanGate,
} from '@vto-swarm/db';
import { loadSecrets, loadChannelIds, AGENTS, type AgentKey } from './config.js';

const secrets = loadSecrets();
const MACHINE_ID = `gateway-${process.platform}-${hostname()}`;
const AGENT_KEYS = Object.keys(AGENTS) as AgentKey[];
const CHANNEL_IDS = loadChannelIds();
const webClients = new Map<AgentKey, WebClient>();

function clientFor(agent: AgentKey): WebClient {
  let c = webClients.get(agent);
  if (!c) {
    const token = secrets[AGENTS[agent].tokenEnv];
    if (!token) throw new Error(`missing token ${AGENTS[agent].tokenEnv}`);
    c = new WebClient(token);
    webClients.set(agent, c);
  }
  return c;
}

/** Real Slack @-mentions of our agent bots, resolved at startup: '<@U123>' → agent role. */
const mentionToAgent = new Map<string, AgentKey>();

/**
 * Which agent is this channel message addressed to? Accepts, in priority order:
 *   1. a REAL Slack mention of the bot   — `<@U123>` (what the @ autocomplete produces)
 *   2. a typed handle                    — `@vto-researcher`, `vto-researcher`, `vto researcher`
 *   3. a short command                   — `!researcher …`, or a leading `researcher: …`
 * So ANY channel member (Rohit or Vansh) can assign a task without knowing the internals.
 */
function parseTarget(text: string): AgentKey | null {
  for (const [mention, agent] of mentionToAgent) {
    if (text.includes(mention)) return agent;
  }
  for (const k of AGENT_KEYS) {
    const re = new RegExp(String.raw`@?vto[-\s]${k}\b|(?:^|\s)!${k}\b|(?:^|\s)${k}\s*:`, 'i');
    if (re.test(text)) return k;
  }
  return null;
}

/** Ask Slack for each agent bot's user id so real @-mentions map back to a role. */
async function resolveMentions(): Promise<void> {
  for (const agent of AGENT_KEYS) {
    if (!secrets[AGENTS[agent].tokenEnv]) continue;
    try {
      const res = await clientFor(agent).auth.test();
      if (res.user_id) {
        mentionToAgent.set(`<@${res.user_id}>`, agent);
        console.log(`[gateway] ${agent} bot = <@${res.user_id}>`);
      }
    } catch (e) {
      console.warn(`[gateway] could not resolve ${agent} bot id:`, (e as Error).message);
    }
  }
}

interface SlackEvent {
  subtype?: string;
  bot_id?: string;
  text?: string;
  channel?: string;
  user?: string;
  ts?: string;
  thread_ts?: string;
  client_msg_id?: string;
}

/**
 * A bare message in #swarm-command (no @mention) is an ORCHESTRATION command: the gateway turns it
 * into an improvement-loop run where Claude (tier-1 strategist) analyzes it and hands the work
 * order to Admin, who decomposes into per-agent tasks. This is how "just type a command" works.
 */
async function maybeAutoTrigger(event: SlackEvent): Promise<void> {
  const cmdChannel = CHANNEL_IDS['swarm-command'];
  if (!cmdChannel || event.channel !== cmdChannel) return;
  if (event.thread_ts) return; // thread replies don't re-trigger
  const text = (event.text ?? '').trim();
  if (text.length < 3) return;
  await enqueueTask({
    role: 'admin',
    kind: 'workflow',
    payload: { workflow: 'improvement-loop', goal: text, channel: event.channel, ts: event.ts },
    channel: event.channel ?? null,
    requestedBy: event.user ?? null,
  });
  console.log(`[gateway] auto-triggered improvement-loop from ${event.user ?? '?'}: ${text.slice(0, 80)}`);
}

async function onEvent(args: { event?: SlackEvent; ack?: () => Promise<void> }): Promise<void> {
  const { event, ack } = args;
  if (ack) await ack();
  // Ignore bot posts (incl. our own poster) and non-text/subtyped messages.
  if (!event || event.subtype || event.bot_id || !event.text) return;
  const dedupId = event.client_msg_id ?? `${event.channel ?? '?'}:${event.ts ?? '?'}`;
  if (!(await dedupSlackEvent(dedupId, event.channel ?? null, event.ts ?? null))) return; // duplicate
  const target = parseTarget(event.text);
  if (!target) {
    await maybeAutoTrigger(event);
    return;
  }
  // Workflow triggers (D-034): "improve <goal>" or "workflow <name>: <goal>" → dispatcher intake.
  const wfMatch = event.text.match(/\b(?:improve|workflow)\s+(?:loop|improvement-loop)?\s*[:,-]?\s*(.+)/i);
  if (target === 'admin' && wfMatch && wfMatch[1]) {
    await enqueueTask({
      role: 'admin',
      kind: 'workflow',
      payload: { workflow: 'improvement-loop', goal: wfMatch[1].trim(), channel: event.channel, ts: event.ts },
      channel: event.channel ?? null,
      requestedBy: event.user ?? null,
    });
    console.log(`[gateway] queued workflow trigger from ${event.user ?? '?'}`);
    return;
  }
  // Health check: "@VTO-Admin health" → every alive worker replies "OK WORKING from <role>".
  const healthMatch = event.text.match(/^\s*(?:@?[\w-]+\s+)?(?:health|status)\b/i) ?? event.text.match(/check\s+all\s+agents?/i);
  if (target === 'admin' && healthMatch) {
    await enqueueTask({
      role: 'admin',
      kind: 'workflow',
      payload: { workflow: 'health-loop', goal: 'swarm health check', channel: event.channel, ts: event.ts },
      channel: event.channel ?? null,
      requestedBy: event.user ?? null,
    });
    console.log(`[gateway] queued health-check from ${event.user ?? '?'}`);
    return;
  }
  await enqueueTask({
    role: target,
    kind: target,
    payload: { text: event.text, slackUser: event.user, channel: event.channel, ts: event.ts },
    channel: event.channel ?? null,
    requestedBy: event.user ?? null,
  });
  console.log(`[gateway] queued ${target} task from ${event.user ?? '?'} in ${event.channel ?? '?'}`);
}

/** Human gate reactions (D-034): 👍/✅ approve, 👎/❌ reject. Gate is resolved by post ts. */
async function onReaction(args: { event?: { item?: { ts?: string }; user?: string; reaction?: string; item_user?: string }; ack?: () => Promise<void> }): Promise<void> {
  const { event, ack } = args;
  if (ack) await ack();
  if (!event?.item?.ts || !event.user || event.item_user === undefined) return;
  if (event.reaction === 'white_check_mark' || event.reaction === '+1' || event.reaction === 'approve') {
    const gate = await getGateByPostTs(event.item.ts);
    if (gate) {
      await approveHumanGate(gate.id, event.user);
      console.log(`[gateway] human gate #${gate.id} approved by ${event.user}`);
    }
  } else if (event.reaction === 'x' || event.reaction === '-1' || event.reaction === 'reject') {
    const gate = await getGateByPostTs(event.item.ts);
    if (gate) {
      await rejectHumanGate(gate.id, event.user);
      console.log(`[gateway] human gate #${gate.id} rejected by ${event.user}`);
    }
  }
}

/** Drain one queued post per tick — ~1/sec globally keeps Slack's per-channel limit safe. */
async function posterTick(): Promise<void> {
  const post = await claimNextPost();
  if (!post) return;
  try {
    const res = await clientFor(post.agent as AgentKey).chat.postMessage({
      channel: post.channel,
      text: post.text,
      thread_ts: post.thread_ts ?? undefined,
    });
    await markPost(post.id, 'sent');
    if (post.link_gate_id && res.ts) await linkGatePost(post.link_gate_id, res.ts);
  } catch (e) {
    console.warn(`[gateway] post ${post.id} failed:`, (e as Error).message);
    await markPost(post.id, 'failed');
  }
}

async function main(): Promise<void> {
  const appToken = secrets.SLACK_APP_TOKEN;
  if (!appToken) throw new Error('SLACK_APP_TOKEN missing in config/.secrets.env');
  await registerMachine(MACHINE_ID, 'rohit', 'gateway');
  await resolveMentions();
  setInterval(() => void heartbeatMachine(MACHINE_ID).catch(() => {}), 30_000);
  setInterval(() => void posterTick().catch((e) => console.warn('[gateway] poster', e)), 1100);

  const socket = new SocketModeClient({ appToken });
  socket.on('connecting', () => console.log('[gateway] socket connecting…'));
  socket.on('hello', () => console.log('[gateway] socket hello — connection established'));
  socket.on('connected', () => console.log('[gateway] socket connected'));
  socket.on('disconnected', (e: unknown) => console.warn('[gateway] socket DISCONNECTED', e));
  socket.on('error', (e: unknown) => console.warn('[gateway] socket error', e));
  socket.on('slack_socket_error', (e: unknown) => console.warn('[gateway] socket error:', e));
  socket.on('message', onEvent);
  socket.on('app_mention', onEvent);
  socket.on('reaction_added', onReaction);
  await socket.start();
  console.log(`[gateway] online as ${MACHINE_ID} — one Slack listener + serialized poster.`);
}

void main().catch((e: unknown) => {
  console.error('[gateway] FATAL', e);
  process.exit(1);
});

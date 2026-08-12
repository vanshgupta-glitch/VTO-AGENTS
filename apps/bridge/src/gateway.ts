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
} from '@vto-swarm/db';
import { loadSecrets, AGENTS, type AgentKey } from './config.js';

const secrets = loadSecrets();
const MACHINE_ID = `gateway-${process.platform}-${hostname()}`;
const AGENT_KEYS = Object.keys(AGENTS) as AgentKey[];
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

/** First `@vto-<agent>` mention in the text → that agent/role, else null. */
function parseTarget(text: string): AgentKey | null {
  const low = text.toLowerCase();
  return AGENT_KEYS.find((k) => low.includes(`@vto-${k}`)) ?? null;
}

interface SlackEvent {
  subtype?: string;
  bot_id?: string;
  text?: string;
  channel?: string;
  user?: string;
  ts?: string;
  client_msg_id?: string;
}

async function onEvent(args: { event?: SlackEvent; ack?: () => Promise<void> }): Promise<void> {
  const { event, ack } = args;
  if (ack) await ack();
  // Ignore bot posts (incl. our own poster) and non-text/subtyped messages.
  if (!event || event.subtype || event.bot_id || !event.text) return;
  const dedupId = event.client_msg_id ?? `${event.channel ?? '?'}:${event.ts ?? '?'}`;
  if (!(await dedupSlackEvent(dedupId, event.channel ?? null, event.ts ?? null))) return; // duplicate
  const target = parseTarget(event.text);
  if (!target) return;
  await enqueueTask({
    role: target,
    kind: target,
    payload: { text: event.text, slackUser: event.user, channel: event.channel, ts: event.ts },
    channel: event.channel ?? null,
    requestedBy: event.user ?? null,
  });
  console.log(`[gateway] queued ${target} task from ${event.user ?? '?'} in ${event.channel ?? '?'}`);
}

/** Drain one queued post per tick — ~1/sec globally keeps Slack's per-channel limit safe. */
async function posterTick(): Promise<void> {
  const post = await claimNextPost();
  if (!post) return;
  try {
    await clientFor(post.agent as AgentKey).chat.postMessage({
      channel: post.channel,
      text: post.text,
      thread_ts: post.thread_ts ?? undefined,
    });
    await markPost(post.id, 'sent');
  } catch (e) {
    console.warn(`[gateway] post ${post.id} failed:`, (e as Error).message);
    await markPost(post.id, 'failed');
  }
}

async function main(): Promise<void> {
  const appToken = secrets.SLACK_APP_TOKEN;
  if (!appToken) throw new Error('SLACK_APP_TOKEN missing in config/.secrets.env');
  await registerMachine(MACHINE_ID, 'rohit', 'gateway');
  setInterval(() => void heartbeatMachine(MACHINE_ID).catch(() => {}), 30_000);
  setInterval(() => void posterTick().catch((e) => console.warn('[gateway] poster', e)), 1100);

  const socket = new SocketModeClient({ appToken });
  socket.on('message', onEvent);
  socket.on('app_mention', onEvent);
  await socket.start();
  console.log(`[gateway] online as ${MACHINE_ID} — one Slack listener + serialized poster.`);
}

void main().catch((e: unknown) => {
  console.error('[gateway] FATAL', e);
  process.exit(1);
});

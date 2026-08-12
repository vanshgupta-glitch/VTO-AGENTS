import { WebClient } from '@slack/web-api';
import { SocketModeClient } from '@slack/socket-mode';
import type { BridgeConfig } from './config.js';
import { createDedupe } from './dedupe.js';

export interface Mention {
  /** Which agent was mentioned, resolved from the bot user id in the text. */
  agent: string;
  channel: string;
  user: string;
  text: string;
  threadTs: string;
  eventId: string;
}

export interface SlackPort {
  post(opts: {
    agent: string;
    channel: string;
    text: string;
    threadTs?: string;
  }): Promise<string | null>;
  start(onMention: (m: Mention) => void | Promise<void>): Promise<void>;
}

/**
 * The only module that talks to Slack, and the only writer to it.
 *
 * Keeping Slack state in one component is what lets `swarm ask` post nothing
 * itself: the CLI calls loopback and the daemon puts both the request and the
 * reply in the thread, so a CLI message can never re-trigger the app_mention
 * listener.
 */
export function createSlack(config: BridgeConfig): SlackPort {
  const clients = new Map<string, WebClient>();

  function secret(name: string): string | undefined {
    return config.secrets.get(name) ?? process.env[name];
  }

  /** One client per agent so every post carries that agent's own identity. */
  function clientFor(agent: string): WebClient {
    const cached = clients.get(agent);
    if (cached) return cached;
    const envName = config.agents.get(agent)?.tokenEnv ?? 'SLACK_BOT_ADMIN';
    const token = secret(envName) ?? secret('SLACK_BOT_ADMIN');
    if (!token) throw new Error(`no Slack token for '${agent}' (looked for ${envName})`);
    const c = new WebClient(token);
    clients.set(agent, c);
    return c;
  }

  return {
    async post(opts): Promise<string | null> {
      const channelId = config.channels.get(opts.channel) ?? opts.channel;
      try {
        const res = await clientFor(opts.agent).chat.postMessage({
          channel: channelId,
          // Slack hard-caps a message at 4000 chars; leave room for the header.
          text: opts.text.slice(0, 3900),
          thread_ts: opts.threadTs,
          unfurl_links: false,
        });
        return (res.ts as string | undefined) ?? null;
      } catch (e) {
        // Slack being unreachable must not stop the daemon serving the CLI, and
        // both log sinks are written regardless, so the record survives.
        process.stderr.write(`[slack] post to #${opts.channel} failed: ${String(e)}\n`);
        return null;
      }
    },

    async start(onMention): Promise<void> {
      const appToken = secret('SLACK_APP_TOKEN');
      if (!appToken) throw new Error('SLACK_APP_TOKEN missing - the listener cannot start');

      // Map every agent's Slack bot user id -> agent name.
      //
      // Only the Admin app runs Socket Mode, so mentioning @VTO-Critic fires
      // app_mention on the CRITIC app, which nobody is listening to. Admin
      // therefore listens to plain `message` events (already in its manifest)
      // and routes on whichever agent id appears in the text. Without this,
      // Slack can only ever reach Admin.
      const idToAgent = new Map<string, string>();
      let selfUserId = '';
      for (const [name] of config.agents) {
        try {
          const who = await clientFor(name).auth.test();
          const uid = String(who.user_id ?? '');
          if (!uid) continue;
          if (name === 'admin') selfUserId = uid;

          // First agent to claim an id keeps it. openclaw deliberately shares
          // Coder's token (it has no Slack app of its own and runs under
          // Coder), so without this a mention of @VTO-Coder would route to
          // openclaw purely because it is later in the map.
          const owner = idToAgent.get(uid);
          if (owner) {
            console.log(`[slack] ${name} shares ${String(who.user ?? '?')} with ${owner} - not directly addressable`);
            continue;
          }
          idToAgent.set(uid, name);
          console.log(`[slack] ${name} -> ${String(who.user ?? '?')} (${uid})`);
        } catch {
          // An agent with no Slack app simply is not addressable from Slack.
          // That is a normal state in Phase 1a, not an error.
        }
      }
      if (!selfUserId) {
        process.stderr.write('[slack] could not resolve admin user id; self-filter disabled\n');
      }

      const dedupe = createDedupe();
      const socket = new SocketModeClient({ appToken });

      const handle = async (args: Record<string, unknown>): Promise<void> => {
        const ack = args['ack'] as (() => Promise<void>) | undefined;
        if (ack) await ack();

        const event = (args['event'] ?? {}) as Record<string, unknown>;
        const body = (args['body'] ?? {}) as Record<string, unknown>;

        // Slack delivers a mention of Admin as BOTH app_mention and message.
        // Dedupe on the message ts, which is identical across both, rather than
        // event_id, which is not -- otherwise every Admin mention runs twice.
        const key = String(event['ts'] ?? body['event_id'] ?? '');
        if (!key || dedupe.seen(key)) return;

        // Structural events are not requests. A "<@U…> has joined the channel"
        // notice carries a real mention token, so without this filter simply
        // inviting the bots dispatched work orders at them -- two agents burned
        // 4 and 9 minutes replying to join notices before this was caught.
        const subtype = String(event['subtype'] ?? '');
        if (subtype && subtype !== 'bot_message' && subtype !== 'thread_broadcast') return;

        const text = String(event['text'] ?? '');
        const sender = String(event['user'] ?? '');
        if (selfUserId && sender === selfUserId) return;

        // Route to the first mentioned agent we know about.
        let target = '';
        for (const m of text.matchAll(/<@([A-Z0-9]+)>/g)) {
          const found = idToAgent.get(m[1]!);
          if (found) { target = found; break; }
        }
        if (!target) return;          // not addressed to any agent
        if (target === sender) return; // an agent mentioning itself

        try {
          await onMention({
            agent: target,
            channel: String(event['channel'] ?? ''),
            user: sender,
            text: text.replace(/<@[A-Z0-9]+>/g, '').trim(),
            threadTs: String(event['thread_ts'] ?? event['ts'] ?? ''),
            eventId: key,
          });
        } catch (e) {
          process.stderr.write(`[slack] handler threw: ${String(e)}\n`);
        }
      };

      // A mention of Admin arrives as BOTH app_mention and message; a mention
      // of any other agent arrives only as message, because Admin is the sole
      // Socket Mode app. Both are wired, and the shared-ts dedupe inside
      // `handle` stops Admin being processed twice.
      socket.on('app_mention', handle);
      socket.on('message', handle);

      await socket.start();
    },
  };
}

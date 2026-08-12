import type { BridgeConfig } from './config.js';
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
export declare function createSlack(config: BridgeConfig): SlackPort;

/**
 * Slack connectivity check. Outbound only, no listener, no model call.
 *
 *     pnpm --filter vto-bridge check:slack
 *
 * Exists as its own step because a bad token and a Socket-Mode problem present
 * identically once the daemon is running. Proving the credentials first turns
 * one ambiguous failure into two unambiguous ones.
 */
import { loadConfig } from './config.js';
import { createSlack } from './slack.js';
const CHANNEL = process.env.SWARM_CHECK_CHANNEL ?? 'swarm-command';
async function main() {
    const config = loadConfig();
    const appToken = config.secrets.get('SLACK_APP_TOKEN') ?? process.env.SLACK_APP_TOKEN;
    const botToken = config.secrets.get('SLACK_BOT_ADMIN') ?? process.env.SLACK_BOT_ADMIN;
    console.log(`  channels in config : ${config.channels.size}`);
    console.log(`  SLACK_APP_TOKEN    : ${appToken ? 'present' : 'MISSING'}`);
    console.log(`  SLACK_BOT_ADMIN    : ${botToken ? 'present' : 'MISSING'}`);
    if (!botToken) {
        console.error('\n  Cannot post without SLACK_BOT_ADMIN. Fill config/.secrets.env.');
        process.exit(1);
    }
    const id = config.channels.get(CHANNEL);
    console.log(`  target             : #${CHANNEL} (${id ?? 'NOT IN channels.yaml'})`);
    const slack = createSlack(config);
    const ts = await slack.post({
        agent: 'admin',
        channel: CHANNEL,
        text: 'Bridge connectivity check. If you can see this, the Admin bot token and channel wiring are good.',
    });
    if (ts) {
        console.log(`\n  [ok] posted, ts=${ts}`);
        return;
    }
    console.error('\n  [fail] post rejected. The [slack] line above carries the API error.');
    console.error('  not_in_channel  -> run  /invite @VTO-Admin  in that channel');
    console.error('  invalid_auth    -> the xoxb- token is wrong or the app was reinstalled');
    console.error('  missing_scope   -> the app needs chat:write');
    process.exit(1);
}
void main();

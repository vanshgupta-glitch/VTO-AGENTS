import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as yaml from 'js-yaml';
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\[[0-9;]*[A-Za-z]/g;
export function stripAnsi(s) {
    return s.replace(ANSI_RE, '');
}
/**
 * Recognise a STUCK declaration in either form.
 *
 * tools/setup.py ascii_fold() rewrites the emoji to "[STUCK]" before a soul is
 * written into a profile, so an agent has literally never seen the unicode
 * form in its own prompt and will emit the folded one. Matching only the emoji
 * would classify every stuck run as a plain success.
 *
 * Anchored to the start of a line so prose like "the build got stuck" does not
 * trip it. No trailing \b: "]" and the newline after it are both non-word
 * characters, so a word boundary can never exist there and the folded form
 * would never match.
 */
const STUCK_RE = /(^|\n)\s*(\[STUCK\]|⛔\s*STUCK)/;
export function isStuck(s) {
    return STUCK_RE.test(`\n${s}`);
}
/**
 * Test-time model override, e.g. SWARM_MODEL_OVERRIDE=nvidia/nemotron-3.5-lightning:free
 *
 * Owner directive: an invocation whose only purpose is to check an agent works
 * must cost effectively nothing. Applied per run rather than by editing
 * agents/*.yaml, because those values are hashed by setup.py verify and a
 * permanent downgrade would be exactly the cost lever the cost spec forbids.
 * Unset in normal operation, where the registry model is authoritative.
 */
const MODEL_OVERRIDE = process.env.SWARM_MODEL_OVERRIDE;
/**
 * Windows caps a whole command line at 32767 characters (CreateProcess).
 *
 * hermes has no prompt-file option -- `-z/--oneshot` takes the prompt inline --
 * so a long prompt would be silently truncated or rejected by the OS with an
 * opaque error. Refusing early with a clear message beats debugging that.
 * Runtimes with a real file option (openclaw --message-file) are unaffected.
 */
const MAX_INLINE_PROMPT = 30_000;
export function createRunner(root, timeoutSeconds) {
    const file = join(root, 'config', 'runtimes.yaml');
    if (!existsSync(file))
        throw new Error(`missing ${file}`);
    const doc = yaml.load(readFileSync(file, 'utf8'));
    const runtimes = doc?.runtimes ?? {};
    function execute(entry, rawArgs, agent, prompt) {
        // The prompt goes in a file, never on the command line: Windows caps a
        // command line at ~32k and a composed instruction can exceed that.
        const dir = mkdtempSync(join(tmpdir(), 'swarm-prompt-'));
        const promptFile = join(dir, 'instruction.txt');
        writeFileSync(promptFile, prompt, 'utf8');
        const args = rawArgs.map((a) => a
            .replace('{profile}', agent.id)
            .replace('{agent}', agent.id)
            .replace('{instruction_file}', promptFile)
            .replace('{instruction}', prompt)
            .replace('{message}', prompt)
            .replace('{model}', agent.model));
        const started = Date.now();
        return new Promise((settle) => {
            let done = false;
            const finish = (r) => {
                if (done)
                    return;
                done = true;
                try {
                    rmSync(dir, { recursive: true, force: true });
                }
                catch {
                    /* best effort: a leftover temp dir must not fail a task */
                }
                settle(r);
            };
            // stdin is 'ignore', not a pipe. None of these runtimes read stdin, and
            // an open-but-never-written pipe leaves a child that polls stdin waiting
            // forever -- opencode hung to the full 900s timeout this way while the
            // identical command run from a shell returned in seconds.
            const child = spawn(entry.bin, args, {
                windowsHide: true,
                shell: false,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let out = '';
            let err = '';
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                child.kill();
            }, timeoutSeconds * 1000);
            child.stdout.on('data', (d) => {
                out += d.toString();
            });
            child.stderr.on('data', (d) => {
                err += d.toString();
            });
            child.on('error', (e) => {
                clearTimeout(timer);
                finish({
                    ok: false, stdout: '', stderr: String(e), code: null,
                    durationMs: Date.now() - started, timedOut: false,
                });
            });
            child.on('close', (code) => {
                clearTimeout(timer);
                const clean = entry.strip_ansi ? stripAnsi(out) : out;
                finish({
                    ok: code === 0 && !timedOut,
                    stdout: clean.trim(),
                    stderr: err.trim(),
                    code,
                    durationMs: Date.now() - started,
                    timedOut,
                });
            });
        });
    }
    function fail(stderr) {
        return { ok: false, stdout: '', stderr, code: null, durationMs: 0, timedOut: false };
    }
    function tooLong(entry, prompt) {
        if (!entry.inline_prompt || prompt.length <= MAX_INLINE_PROMPT)
            return null;
        return fail(`prompt is ${prompt.length} chars but this runtime passes it on the command ` +
            `line, which Windows caps near ${MAX_INLINE_PROMPT}. Shorten the task or ` +
            `route it to a runtime with a message-file option.`);
    }
    return {
        async run(agent, prompt) {
            const entry = runtimes[agent.runtime];
            if (!entry?.bin)
                return fail(`no runtime '${agent.runtime}' with a bin in runtimes.yaml`);
            let args = entry.cmd_template ?? [];
            if (MODEL_OVERRIDE && entry.model_override_template) {
                args = [...args, ...entry.model_override_template.map((a) => a.replace('{model}', MODEL_OVERRIDE))];
            }
            return tooLong(entry, prompt) ?? execute(entry, args, agent, prompt);
        },
        async runRaw(agent, args, prompt = '') {
            const entry = runtimes[agent.runtime];
            if (!entry?.bin)
                return fail(`no runtime '${agent.runtime}' with a bin in runtimes.yaml`);
            return execute(entry, args, agent, prompt);
        },
    };
}

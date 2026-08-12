import { isStuck } from './runtimes.js';
import { nextTaskId, formatHeader } from './header.js';
/**
 * The core. Deliberately transport-blind: it knows nothing about Slack or HTTP.
 *
 * Adding Critic and Coder in Phase 1b is a change to what this calls, not to
 * how requests arrive -- which is the whole reason the boundary is here.
 */
export function createDispatcher(deps) {
    const { config, runner, logger } = deps;
    return {
        async dispatch(req) {
            const taskId = nextTaskId(config.paths.stateFile);
            const spec = config.agents.get(req.agent);
            if (!spec) {
                const error = `unknown agent '${req.agent}'`;
                logger.logEvent({
                    task: taskId, agent: req.agent, origin: req.origin, stage: 'reject',
                    level: 'err', channel: req.channel, outcome: 'error', message: error,
                });
                return { ok: false, taskId, reply: '', outcome: 'error', error };
            }
            logger.logEvent({
                task: taskId, agent: spec.id, origin: req.origin, stage: 'received',
                level: 'info', channel: req.channel, message: req.text,
            });
            const prompt = `${formatHeader(taskId, 0, 'decompose')}\n\n${req.text}`;
            const run = await runner.run(spec, prompt);
            // Order matters: a timed-out run may also have produced partial output
            // that happens to contain a STUCK block, and the timeout is the more
            // accurate description of what went wrong.
            let outcome;
            if (run.timedOut)
                outcome = 'timeout';
            else if (isStuck(run.stdout))
                outcome = 'stuck';
            else if (!run.ok)
                outcome = 'error';
            else
                outcome = 'success';
            const ok = outcome === 'success';
            logger.logEvent({
                task: taskId,
                agent: spec.id,
                origin: req.origin,
                stage: ok ? 'complete' : 'failed',
                level: ok ? 'info' : 'err',
                channel: req.channel,
                durationMs: run.durationMs,
                outcome,
                message: ok ? run.stdout : run.stderr || run.stdout || 'no output',
            });
            return {
                ok,
                taskId,
                // Returned verbatim. A STUCK block's four fields ARE the diagnostic;
                // summarising it destroys the thing recovery needs.
                reply: run.stdout,
                outcome,
                error: ok ? undefined : run.stderr || `exit ${run.code}`,
            };
        },
    };
}

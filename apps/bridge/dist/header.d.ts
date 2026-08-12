/**
 * The task header every swarm message carries.
 *
 * The separator is U+00B7 MIDDLE DOT. config/bridge.config.yaml declared this
 * pattern as '\\[T(\\d+) \\· loop ...' -- but YAML single quotes do not process
 * backslash escapes, so the regex engine received an escaped literal backslash
 * followed by an open character class. It could never match, and
 * task_header.required was true, so a faithful implementation would have
 * rejected every message.
 */
export declare const HEADER_RE: RegExp;
export declare function formatHeader(task: string, loop: number, stage: string): string;
export declare function parseHeader(s: string): {
    task: string;
    loop: number;
    stage: string;
} | null;
/**
 * Monotonic task counter.
 *
 * An interim home for what becomes `data/runs.db` under the cost-minimal-memory
 * spec. One field, chosen so this does not take a dependency on unbuilt work.
 * A corrupt file restarts the counter rather than throwing: a daemon that
 * cannot allocate a task id is a daemon that cannot serve any request, and
 * duplicate ids are a smaller problem than an outage.
 */
export declare function nextTaskId(stateFile: string): string;

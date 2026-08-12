export interface Dedupe {
    seen(id: string): boolean;
}
/**
 * Bounded set of event ids already handled.
 *
 * Slack redelivers any event it does not see acknowledged within three
 * seconds. A Hermes call routinely takes far longer than that, so without both
 * an early ack and this check a single mention is answered three times.
 *
 * Bounded rather than unbounded because the daemon is long-running: an
 * ever-growing Set is a slow leak.
 */
export declare function createDedupe(max?: number): Dedupe;

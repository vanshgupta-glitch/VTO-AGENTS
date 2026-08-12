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
export function createDedupe(max = 500) {
    const order = [];
    const set = new Set();
    return {
        seen(id) {
            if (set.has(id))
                return true;
            set.add(id);
            order.push(id);
            while (order.length > max) {
                const oldest = order.shift();
                if (oldest !== undefined)
                    set.delete(oldest);
            }
            return false;
        },
    };
}

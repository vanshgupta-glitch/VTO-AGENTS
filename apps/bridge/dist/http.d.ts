import type { DispatchRequest, DispatchResult } from './dispatch.js';
export interface HttpHandle {
    close(): void;
}
/**
 * Loopback entry point for `swarm ask`.
 *
 * Bound to 127.0.0.1 explicitly, never 0.0.0.0: this accepts unauthenticated
 * requests that spend tokens, so it must not be reachable off the machine.
 */
export declare function startHttp(port: number, handle: (req: DispatchRequest) => Promise<DispatchResult>): HttpHandle;

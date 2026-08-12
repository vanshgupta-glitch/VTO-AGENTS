import { createServer } from 'node:http';
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
export function startHttp(
  port: number,
  handle: (req: DispatchRequest) => Promise<DispatchResult>,
): HttpHandle {
  const server = createServer((req, res) => {
    const json = (code: number, body: unknown): void => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (req.method === 'GET' && req.url === '/health') {
      json(200, { ok: true });
      return;
    }
    if (req.method !== 'POST' || req.url !== '/ask') {
      json(404, { error: 'not found' });
      return;
    }

    let body = '';
    let aborted = false;
    req.on('data', (c: Buffer) => {
      body += c.toString();
      if (body.length > 100_000) {
        aborted = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (aborted) return;
      void (async () => {
        try {
          const parsed = JSON.parse(body || '{}') as { agent?: string; text?: string };
          if (!parsed.text) {
            json(400, { error: 'text required' });
            return;
          }
          const out = await handle({
            agent: parsed.agent ?? 'admin',
            text: parsed.text,
            origin: 'cli',
          });
          json(200, out);
        } catch (e) {
          json(500, { error: String(e) });
        }
      })();
    });
  });

  server.listen(port, '127.0.0.1');
  return { close: () => server.close() };
}

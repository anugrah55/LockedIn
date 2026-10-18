import type { Provider, StructuredRequest } from './types.js';

/** Test double: returns canned responses in order and records requests. */
export function createMockProvider(responses: unknown[]): Provider & { calls: StructuredRequest<unknown>[] } {
  const queue = [...responses];
  const calls: StructuredRequest<unknown>[] = [];
  return {
    name: 'claude',
    label: 'Mock',
    calls,
    async runStructured<T>(req: StructuredRequest<T>): Promise<T> {
      calls.push(req as StructuredRequest<unknown>);
      if (!queue.length) throw new Error('Mock provider: no responses left');
      return req.schema.parse(queue.shift());
    },
  };
}

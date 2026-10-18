import { describe, expect, it } from 'vitest';
import { toStrictJsonSchema } from '../src/schemas/json-schema.js';
import { ProfileDraft } from '../src/schemas/profile.js';
import { RankResult, TailorResult } from '../src/schemas/tailored.js';

/** OpenAI strict mode: every object lists all its properties as required and forbids extras. */
function assertStrict(node: unknown, path = '$'): void {
  if (Array.isArray(node)) return node.forEach((n, i) => assertStrict(n, `${path}[${i}]`));
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  if (obj.type === 'object') {
    const props = Object.keys((obj.properties as object) ?? {});
    expect(obj.additionalProperties, `${path}.additionalProperties`).toBe(false);
    expect([...(obj.required as string[])].sort(), `${path}.required`).toEqual(props.sort());
  }
  for (const [k, v] of Object.entries(obj)) assertStrict(v, `${path}.${k}`);
}

describe('toStrictJsonSchema', () => {
  for (const [name, schema] of Object.entries({ ProfileDraft, RankResult, TailorResult })) {
    it(`${name} is OpenAI-strict compatible`, () => {
      const json = toStrictJsonSchema(schema);
      expect(json.$schema).toBeUndefined();
      assertStrict(json);
    });
  }
});

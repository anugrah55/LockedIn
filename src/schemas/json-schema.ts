import { z } from 'zod';

export type JSONSchema = Record<string, unknown>;

/**
 * Convert a zod schema to a JSON schema that satisfies OpenAI strict mode
 * (used by `codex exec --output-schema`) and is also accepted by
 * `claude --json-schema`: every object lists all properties as required and
 * forbids additional properties.
 */
export function toStrictJsonSchema(schema: z.ZodType): JSONSchema {
  const raw = z.toJSONSchema(schema, { target: 'draft-7' }) as JSONSchema;
  delete raw.$schema;
  return strictify(raw) as JSONSchema;
}

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) out[k] = strictify(v);
  if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
    out.required = Object.keys(out.properties);
    out.additionalProperties = false;
  }
  return out;
}

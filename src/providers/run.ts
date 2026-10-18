import { z } from 'zod';
import type { StructuredRequest } from './types.js';
import { ProviderError } from './types.js';

export const DEFAULT_TIMEOUT_MS = 5 * 60_000;

/** Validate model output, retrying once (with the error fed back) on failure. */
export async function withValidation<T>(
  req: StructuredRequest<T>,
  call: (input: string) => Promise<unknown>,
): Promise<T> {
  let input = req.input;
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await call(input);
    const parsed = req.schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    lastError = z.prettifyError(parsed.error);
    input = `${req.input}\n\nYour previous answer did not match the required schema:\n${lastError}\nReturn corrected JSON only.`;
  }
  throw new ProviderError('Model output did not match the expected format.', lastError);
}

/** Pull a JSON value out of free text (handles ```json fences). */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
    throw new ProviderError('Model did not return JSON.', text.slice(0, 500));
  }
}

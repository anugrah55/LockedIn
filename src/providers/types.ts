import type { z } from 'zod';
import type { ProviderName } from '../store/index.js';

export interface StructuredRequest<T> {
  /** Instructions for the model (system-level). */
  system: string;
  /** Task + data. Sent via stdin, so it can be large. */
  input: string;
  schema: z.ZodType<T>;
  timeoutMs?: number;
}

export interface Provider {
  name: ProviderName;
  label: string;
  runStructured<T>(req: StructuredRequest<T>): Promise<T>;
}

export interface ProviderStatus {
  name: ProviderName;
  label: string;
  installed: boolean;
  loggedIn: boolean;
  hint: string | null;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

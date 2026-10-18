import type { Config } from '../store/index.js';
import { claudeStatus, createClaudeProvider } from './claude.js';
import { codexStatus, createCodexProvider } from './codex.js';
import type { Provider, ProviderStatus } from './types.js';

export * from './types.js';

export async function detectProviders(): Promise<ProviderStatus[]> {
  return Promise.all([claudeStatus(), codexStatus()]);
}

export function createProvider(config: Pick<Config, 'provider' | 'model'>): Provider {
  switch (config.provider) {
    case 'claude':
      return createClaudeProvider(config.model);
    case 'codex':
      return createCodexProvider(config.model);
    default:
      throw new Error('No AI provider configured. Run `lockedin config`.');
  }
}
